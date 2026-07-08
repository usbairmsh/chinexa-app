import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute, escapeLike } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError, dependencyError } from "@/lib/validate";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { ensureSearchIndexes } from "@/lib/migrate-search";
import { pingIndexNowUrl } from "@/lib/indexnow";

interface ProductRow extends RowDataPacket {
  id: string; name: string; slug: string; description: string; short_description: string;
  sku: string; price: number; compare_at_price: number | null; currency: string;
  category_id: string; category_name: string; subcategory: string | null;
  tags: string; badges: string; stock_quantity: number; is_active: number;
  is_featured: number; average_rating: number; review_count: number;
  country_of_origin: string | null; weight: string | null;
  ingredients: string | null; how_to_use: string | null;
  seo_title: string | null; seo_description: string | null;
  created_at: string; updated_at: string;
}

interface ImageRow extends RowDataPacket {
  id: string; product_id: string; url: string; alt: string; order: number;
}

interface VariantRow extends RowDataPacket {
  id: string; product_id: string; name: string; type: string; value: string;
  hex: string | null; price_adjustment: number; stock: number; sku: string;
}

interface CountRow extends RowDataPacket { total: number; }

function buildProduct(row: ProductRow, images: ImageRow[], variants: VariantRow[]) {
  return {
    id: row.id, name: row.name, slug: row.slug,
    description: row.description, short_description: row.short_description,
    sku: row.sku, price: Number(row.price),
    compare_at_price: row.compare_at_price ? Number(row.compare_at_price) : undefined,
    currency: row.currency,
    images: images.filter((i) => i.product_id === row.id).map((i) => ({ id: i.id, url: i.url, alt: i.alt || "", order: i.order })),
    category_id: row.category_id, category_name: row.category_name,
    subcategory: row.subcategory || undefined,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags || "[]") : row.tags || [],
    badges: typeof row.badges === "string" ? JSON.parse(row.badges || "[]") : row.badges || [],
    variants: variants.filter((v) => v.product_id === row.id).map((v) => ({
      id: v.id, name: v.name, type: v.type as "size" | "color" | "shade" | "weight",
      value: v.value, hex: v.hex || undefined,
      price_adjustment: Number(v.price_adjustment), stock: v.stock, sku: v.sku,
      image: v.image || undefined,
    })),
    stock_quantity: row.stock_quantity, is_active: !!row.is_active, is_featured: !!row.is_featured,
    average_rating: Number(row.average_rating), review_count: row.review_count,
    country_of_origin: row.country_of_origin || undefined, weight: row.weight || undefined,
    ingredients: row.ingredients || undefined, how_to_use: row.how_to_use || undefined,
    trust_badges: typeof row.trust_badges === "string" ? JSON.parse(row.trust_badges || "[]") : row.trust_badges || [],
    seo_title: row.seo_title || undefined, seo_description: row.seo_description || undefined,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

// InnoDB's default minimum indexed word length — words shorter than this are
// never stored in the FULLTEXT index at all, so marking one `+` (required)
// makes MATCH...AGAINST return nothing even when every other word matches.
const FULLTEXT_MIN_WORD_LEN = 3;

/**
 * Builds a FULLTEXT boolean-mode query string from free-text, possibly
 * multi-word user input. Words at/above the FULLTEXT minimum length are
 * marked `+` (required) with a trailing `*` for prefix matching (so "leath"
 * matches "leather" mid-typing); shorter words (e.g. "c", "4k") are left as
 * plain optional terms, since InnoDB never indexes them and marking one
 * `+`-required would silently zero out an otherwise-good multi-word match
 * (e.g. searching "vitamin c serum" must not fail just because "c" alone
 * can't be matched).
 */
function toBooleanFulltextQuery(term: string): string {
  return term
    .split(/\s+/)
    .map((w) => w.replace(/[+\-<>()~*"@]/g, "")) // strip FULLTEXT boolean-mode operators from user input
    .filter(Boolean)
    .map((w) => (w.length >= FULLTEXT_MIN_WORD_LEN ? `+${w}*` : w))
    .join(" ");
}

export async function GET(req: NextRequest) {
  try {
    await ensureSearchIndexes();
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("page_size")) || 12;
    const category = searchParams.get("category");
    const subcategory = searchParams.get("subcategory");
    const brand = searchParams.get("brand");
    const sortBy = searchParams.get("sort_by") || "featured";
    const search = searchParams.get("search")?.trim() || "";
    const badges = searchParams.get("badges");
    const minPrice = searchParams.get("min_price");
    const maxPrice = searchParams.get("max_price");
    const featured = searchParams.get("featured");
    const limit = searchParams.get("limit");

    const all = searchParams.get("all");
    let where = all ? "WHERE 1=1" : "WHERE p.is_active = 1";
    const params: (string | number)[] = [];
    // Relevance score selected alongside the row when searching, so results
    // can be ordered by match quality instead of just created_at/featured.
    let relevanceSelect = "";
    let relevanceParams: (string | number)[] = [];

    if (category) {
      // Check if this slug is a subcategory (has a parent_id) or a parent category
      where += ` AND (
        CASE
          WHEN EXISTS (SELECT 1 FROM categories WHERE slug = ? AND parent_id IS NOT NULL)
          THEN (
            p.subcategory IN (SELECT name FROM categories WHERE slug = ?)
            OR p.category_id IN (SELECT id FROM categories WHERE slug = ?)
          )
          ELSE (
            p.category_id = ?
            OR p.category_id IN (SELECT id FROM categories WHERE slug = ?)
          )
        END
      )`;
      params.push(category, category, category, category, category);
    }
    if (subcategory) {
      // Support comma-separated subcategories for multi-select
      const subs = subcategory.split(",").map((s) => s.trim()).filter(Boolean);
      if (subs.length === 1) {
        where += " AND (p.subcategory = ? OR p.subcategory IN (SELECT name FROM categories WHERE slug = ?))";
        params.push(subs[0], subs[0]);
      } else if (subs.length > 1) {
        const placeholders = subs.map(() => "?").join(",");
        where += ` AND (p.subcategory IN (${placeholders}) OR p.subcategory IN (SELECT name FROM categories WHERE slug IN (${placeholders})))`;
        params.push(...subs, ...subs);
      }
    }
    if (brand) {
      // Support comma-separated brands for multi-select
      const brandNames = brand.split(",").map((b) => b.trim()).filter(Boolean);
      if (brandNames.length === 1) {
        where += " AND p.brand_name = ?";
        params.push(brandNames[0]);
      } else if (brandNames.length > 1) {
        const placeholders = brandNames.map(() => "?").join(",");
        where += ` AND p.brand_name IN (${placeholders})`;
        params.push(...brandNames);
      }
    }
    if (search) {
      const booleanQuery = toBooleanFulltextQuery(search);
      const likeTerm = `%${escapeLike(search)}%`;
      const skuLike = `${escapeLike(search)}%`; // prefix match — SKUs are short codes FULLTEXT handles poorly
      const matchColumns = "p.name, p.short_description, p.description, p.category_name, p.subcategory, p.brand_name, p.sku, p.ingredients, p.how_to_use, p.seo_title, p.seo_description, p.country_of_origin, p.weight";
      if (booleanQuery) {
        // FULLTEXT covers every admin-entered text field on the product for
        // real relevance-ranked search. A plain LIKE on the raw phrase against
        // `name`/`tags` fills the gaps FULLTEXT structurally can't: short/
        // stopword-only queries, hyphenated/compound codes that don't split on
        // word boundaries the way FULLTEXT expects, and the tags column (JSON,
        // can't be part of a FULLTEXT index at all). SKU prefix LIKE and a
        // variant-name/value LIKE cover short exact-ish codes and the separate
        // variants child table.
        where += ` AND (
          MATCH(${matchColumns}) AGAINST (? IN BOOLEAN MODE)
          OR p.name LIKE ?
          OR p.tags LIKE ?
          OR p.sku LIKE ?
          OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND (pv.name LIKE ? OR pv.value LIKE ?))
        )`;
        params.push(booleanQuery, likeTerm, likeTerm, skuLike, skuLike, skuLike);
        relevanceSelect = `, MATCH(${matchColumns}) AGAINST (? IN BOOLEAN MODE) AS relevance`;
        relevanceParams = [booleanQuery];
      }
    }
    if (badges) { where += " AND p.badges LIKE ?"; params.push(`%${escapeLike(badges)}%`); }
    if (minPrice) { where += " AND p.price >= ?"; params.push(Number(minPrice)); }
    if (maxPrice) { where += " AND p.price <= ?"; params.push(Number(maxPrice)); }
    if (featured === "true") { where += " AND p.is_featured = 1"; }

    // Relevance is the default sort while searching (unless the user picked a
    // specific sort like price/newest) — best matches first, not just newest.
    let orderBy = "ORDER BY p.is_featured DESC, p.created_at DESC";
    if (sortBy === "newest") orderBy = "ORDER BY p.created_at DESC";
    else if (sortBy === "price_asc") orderBy = "ORDER BY p.price ASC";
    else if (sortBy === "price_desc") orderBy = "ORDER BY p.price DESC";
    else if (sortBy === "rating") orderBy = "ORDER BY p.average_rating DESC";
    else if (sortBy === "name_asc") orderBy = "ORDER BY p.name ASC";
    else if (relevanceSelect && sortBy === "featured") orderBy = "ORDER BY relevance DESC, p.is_featured DESC";

    // Count
    const countRows = await query<CountRow[]>(`SELECT COUNT(*) as total FROM products p ${where}`, params);
    const total = countRows[0]?.total || 0;

    // Fire-and-forget search logging — powers real trending-searches data.
    // Never awaited into the response path; a logging failure must not affect
    // search results.
    if (search) {
      execute("INSERT INTO search_logs (term, result_count) VALUES (?, ?)", [search.slice(0, 255), total]).catch(() => {});
    }

    // If limit param, use it directly (for featured/new/best/trending queries)
    const actualLimit = limit ? Number(limit) : pageSize;
    const offset = limit ? 0 : (page - 1) * pageSize;

    // Products — relevanceSelect's param must be bound first since it appears
    // earlier in the SQL string (SELECT clause) than the WHERE clause params.
    const safeLimit = Math.max(1, Math.min(Math.floor(actualLimit), 100));
    const safeOffset = Math.max(0, Math.floor(offset));
    const products = await query<ProductRow[]>(
      `SELECT p.*${relevanceSelect} FROM products p ${where} ${orderBy} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      [...relevanceParams, ...params]
    );

    if (products.length === 0) {
      return NextResponse.json({ data: [], total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) });
    }

    // Batch load images and variants
    const productIds = products.map((p) => p.id);
    const placeholders = productIds.map(() => "?").join(",");

    const images = await query<ImageRow[]>(`SELECT * FROM product_images WHERE product_id IN (${placeholders}) ORDER BY \`order\``, productIds);
    const variants = await query<VariantRow[]>(`SELECT * FROM product_variants WHERE product_id IN (${placeholders})`, productIds);

    const data = products.map((p) => buildProduct(p, images, variants));

    return NextResponse.json({
      data,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const body = await req.json();

    // Validate required fields
    const err = validate([
      { field: "name", value: body.name, rules: ["required", "string", { minLength: 2 }, { maxLength: 255 }], label: "Product name" },
      { field: "price", value: Number(body.price), rules: ["required", "number", "positive"], label: "Price" },
    ]);
    if (err) return validationError(err);

    // Validate category exists if provided
    if (body.category_id) {
      const catRows = await query<RowDataPacket[]>("SELECT id, name FROM categories WHERE id = ?", [body.category_id]);
      if (catRows.length === 0) return dependencyError("Category", body.category_id);
      if (!body.category_name) body.category_name = catRows[0].name;
    }

    // Validate price logic
    if (body.compare_at_price && Number(body.compare_at_price) <= Number(body.price)) {
      return validationError("Compare-at price must be higher than the selling price");
    }

    const id = `prod-${Date.now()}`;
    const slug = body.name.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
    const sku = body.sku || `PRD-${Date.now().toString(36).toUpperCase()}`;

    await query(
      `INSERT INTO products (id, name, slug, description, short_description, sku, price, compare_at_price, currency, category_id, category_name, subcategory, brand_id, brand_name, tags, badges, trust_badges, stock_quantity, min_stock, max_stock, is_active, is_featured, country_of_origin, weight, ingredients, how_to_use, seo_title, seo_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BDT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.name, slug,
        body.description || "", body.short_description || "",
        sku, Number(body.price) || 0, body.compare_at_price ? Number(body.compare_at_price) : null,
        body.category_id || null, body.category_name || body.category_id || "",
        body.subcategory || null,
        body.brand_id || null, body.brand_name || null,
        JSON.stringify(body.tags || []), JSON.stringify(body.badges || []),
        JSON.stringify(body.trust_badges || []),
        Number(body.stock_quantity) || 0, Number(body.min_stock) || 10, Number(body.max_stock) || 100,
        body.is_active !== false ? 1 : 0, body.is_featured ? 1 : 0,
        body.country_of_origin || null, body.weight || null,
        body.ingredients || null, body.how_to_use || null,
        body.seo_title || null, body.seo_description || null,
      ]
    );

    // Insert images
    if (body.images?.length) {
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (img.url) {
          await query(
            "INSERT INTO product_images (id, product_id, url, alt, `order`) VALUES (?, ?, ?, ?, ?)",
            [`img-${id}-${i}`, id, img.url, img.alt || "", i]
          );
        }
      }
    }

    // Insert variants
    if (body.variants?.length) {
      for (let i = 0; i < body.variants.length; i++) {
        const v = body.variants[i];
        if (v.name) {
          await query(
            "INSERT INTO product_variants (id, product_id, name, type, value, hex, price_adjustment, stock, sku, image, focal_point) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [`v-${id}-${i}`, id, v.name, v.type || "size", v.value || v.name, v.hex || null, Number(v.price_adjustment) || 0, Number(v.stock) || 0, v.sku || `${sku}-${i}`, v.image || null, v.focal_point || null]
          );
        }
      }
    }

    // Update category product count
    if (body.category_id) {
      await query("UPDATE categories SET product_count = (SELECT COUNT(*) FROM products WHERE category_id = ? AND is_active = 1) WHERE id = ?", [body.category_id, body.category_id]);
    }

    await logActivity("Created product", "product", id, body.name);

    // Fire-and-forget — tell IndexNow-supporting search engines (Bing, Yandex,
    // etc.) this URL exists right now instead of waiting for their own crawl
    // schedule to rediscover it via the sitemap.
    if (body.is_active !== false) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
      pingIndexNowUrl(`${siteUrl}/products/${slug}`);
    }

    return NextResponse.json({ success: true, id, slug }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Duplicate entry") && message.includes("slug")) return NextResponse.json({ error: "A product with this name already exists" }, { status: 409 });
    if (message.includes("Duplicate entry") && message.includes("sku")) return NextResponse.json({ error: "A product with this SKU already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create product. Please check all fields and try again." }, { status: 500 });
  }
}
