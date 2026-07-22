import { query, execute, escapeLike } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import type { Product, ProductListParams } from "@/types/product";
import type { PaginatedResponse } from "@/types/api";

interface ProductRow extends RowDataPacket { [key: string]: unknown; }
interface ImageRow extends RowDataPacket { id: string; product_id: string; url: string; alt: string; order: number; }
interface VariantRow extends RowDataPacket {
  id: string; product_id: string; name: string; type: string; value: string; hex: string | null;
  price_adjustment: number; cost_price_adjustment: number; stock: number; sku: string;
  image: string | null; focal_point: string | null;
}

/**
 * Shared row-shaping for a single product, by slug or id — used by both the
 * public /api/products/[id] route and the product detail page's server-side
 * prefetch, so the two can never drift out of shape from each other.
 * cost_price is stripped: this is the public+admin-storefront shared shape,
 * never the admin-only one that includes margin data.
 */
export async function getProductBySlugOrId(slugOrId: string): Promise<Product | null> {
  const products = await query<ProductRow[]>(
    "SELECT * FROM products WHERE slug = ? OR id = ? LIMIT 1",
    [slugOrId, slugOrId]
  );
  if (products.length === 0) return null;

  const product = products[0];
  const [images, variants] = await Promise.all([
    query<ImageRow[]>("SELECT * FROM product_images WHERE product_id = ? ORDER BY `order`", [product.id as string]),
    query<VariantRow[]>("SELECT * FROM product_variants WHERE product_id = ?", [product.id as string]),
  ]);

  const { cost_price: _costPrice, ...publicProduct } = product;
  void _costPrice;

  return {
    ...publicProduct,
    price: Number(product.price),
    compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : undefined,
    preorder_release_date: product.preorder_release_date ? String(product.preorder_release_date).slice(0, 10) : undefined,
    is_active: !!product.is_active,
    is_featured: !!product.is_featured,
    average_rating: Number(product.average_rating),
    tags: typeof product.tags === "string" ? JSON.parse(product.tags || "[]") : product.tags || [],
    badges: typeof product.badges === "string" ? JSON.parse(product.badges || "[]") : product.badges || [],
    hidden_card_badges: typeof product.hidden_card_badges === "string" ? JSON.parse(product.hidden_card_badges || "[]") : (product.hidden_card_badges || []),
    trust_badges: typeof product.trust_badges === "string" ? JSON.parse(product.trust_badges || "[]") : product.trust_badges || [],
    images: images.map((i) => ({ id: i.id, url: i.url, alt: i.alt || "", order: i.order })),
    variants: variants.map((v) => ({
      id: v.id, name: v.name, type: v.type as Product["variants"][number]["type"], value: v.value,
      hex: v.hex || undefined, price_adjustment: Number(v.price_adjustment), stock: v.stock, sku: v.sku,
      image: v.image || undefined, focal_point: v.focal_point || undefined,
    })),
  } as Product;
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
    .map((w) => w.replace(/[+\-<>()~*"@]/g, ""))
    .filter(Boolean)
    .map((w) => (w.length >= FULLTEXT_MIN_WORD_LEN ? `+${w}*` : w))
    .join(" ");
}

/**
 * Shared product-listing query — used by both /api/products (GET) and the
 * category page's server-side prefetch, so the SSR'd first page of results
 * is byte-for-byte what the client's own useProducts() call would fetch,
 * and the two can never drift out of sync with each other.
 */
export async function getProductsList(searchParams: URLSearchParams): Promise<PaginatedResponse<Product> & { data: Product[] }> {
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("page_size")) || 12;
  const category = searchParams.get("category");
  const subcategory = searchParams.get("subcategory");
  const brand = searchParams.get("brand");
  const sortBy = searchParams.get("sort_by") || "featured";
  // Capped — an unbounded string reaching the FULLTEXT/LIKE query below is
  // both pointless (no real search term is this long) and needlessly heavy
  // for MySQL to evaluate against every product row.
  const search = (searchParams.get("search")?.trim() || "").slice(0, 200);
  const badges = searchParams.get("badges");
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");
  const featured = searchParams.get("featured");
  const exclusive = searchParams.get("exclusive");
  const limit = searchParams.get("limit");

  const all = searchParams.get("all");
  let where = all ? "WHERE 1=1" : "WHERE p.is_active = 1";
  const params: (string | number)[] = [];
  let relevanceSelect = "";
  let relevanceParams: (string | number)[] = [];

  if (category) {
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
    const skuLike = `${escapeLike(search)}%`;
    const matchColumns = "p.name, p.short_description, p.description, p.category_name, p.subcategory, p.brand_name, p.sku, p.ingredients, p.how_to_use, p.seo_title, p.seo_description, p.country_of_origin, p.weight";
    if (booleanQuery) {
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
  // "Exclusive" is now an explicit product badge (like preorder), set by the
  // admin in the product form — NOT a computed recently-added/restocked window.
  // A product is exclusive iff it carries the `exclusive` badge.
  if (exclusive === "true") {
    where += " AND p.badges LIKE ?";
    params.push(`%\"exclusive\"%`);
  }

  let orderBy = "ORDER BY p.is_featured DESC, p.created_at DESC";
  if (sortBy === "newest") orderBy = "ORDER BY p.created_at DESC";
  else if (sortBy === "price_asc") orderBy = "ORDER BY p.price ASC";
  else if (sortBy === "price_desc") orderBy = "ORDER BY p.price DESC";
  else if (sortBy === "rating") orderBy = "ORDER BY p.average_rating DESC";
  else if (sortBy === "name_asc") orderBy = "ORDER BY p.name ASC";
  // "restocked" = freshness: most-recent add or restock first. Used by the
  // Exclusive listing. GREATEST over created_at and last_restocked_at so a
  // restock bumps an old product to the top.
  else if (sortBy === "restocked") orderBy = "ORDER BY GREATEST(p.created_at, COALESCE(p.last_restocked_at, p.created_at)) DESC";
  // Admin: sort by out-of-stock wishlist demand (highest first).
  else if (sortBy === "wishlist_desc") orderBy = "ORDER BY p.oos_wishlist_count DESC, p.created_at DESC";
  else if (sortBy === "date_added") orderBy = "ORDER BY p.created_at DESC";
  else if (relevanceSelect && sortBy === "featured") orderBy = "ORDER BY relevance DESC, p.is_featured DESC";

  const actualLimit = limit ? Number(limit) : pageSize;
  const offset = limit ? 0 : (page - 1) * pageSize;
  const safeLimit = Math.max(1, Math.min(Math.floor(actualLimit), 100));
  const safeOffset = Math.max(0, Math.floor(offset));

  const [countRows, products] = await Promise.all([
    query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM products p ${where}`, params),
    query<RowDataPacket[]>(
      `SELECT p.*${relevanceSelect} FROM products p ${where} ${orderBy} LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      [...relevanceParams, ...params]
    ),
  ]);
  const total = countRows[0]?.total || 0;

  if (search) {
    execute("INSERT INTO search_logs (term, result_count) VALUES (?, ?)", [search.slice(0, 255), total]).catch(() => {});
  }

  if (products.length === 0) {
    return { data: [], total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) };
  }

  const productIds = products.map((p) => p.id);
  const placeholders = productIds.map(() => "?").join(",");
  const [images, variants] = await Promise.all([
    query<RowDataPacket[]>(`SELECT * FROM product_images WHERE product_id IN (${placeholders}) ORDER BY \`order\``, productIds),
    query<RowDataPacket[]>(`SELECT * FROM product_variants WHERE product_id IN (${placeholders})`, productIds),
  ]);

  const buildProduct = (row: RowDataPacket) => ({
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
    hidden_card_badges: typeof row.hidden_card_badges === "string" ? JSON.parse(row.hidden_card_badges || "[]") : (row.hidden_card_badges || []),
    variants: variants.filter((v) => v.product_id === row.id).map((v) => ({
      id: v.id, name: v.name, type: v.type as "size" | "color" | "shade" | "weight",
      value: v.value, hex: v.hex || undefined,
      price_adjustment: Number(v.price_adjustment), stock: v.stock, sku: v.sku,
      image: v.image || undefined,
    })),
    stock_quantity: row.stock_quantity, is_active: !!row.is_active, is_featured: !!row.is_featured,
    preorder_release_date: row.preorder_release_date ? String(row.preorder_release_date).slice(0, 10) : undefined,
    last_restocked_at: row.last_restocked_at || undefined,
    oos_wishlist_count: Number(row.oos_wishlist_count) || 0,
    average_rating: Number(row.average_rating), review_count: row.review_count,
    country_of_origin: row.country_of_origin || undefined, weight: row.weight || undefined,
    ingredients: row.ingredients || undefined, how_to_use: row.how_to_use || undefined,
    trust_badges: typeof row.trust_badges === "string" ? JSON.parse(row.trust_badges || "[]") : row.trust_badges || [],
    seo_title: row.seo_title || undefined, seo_description: row.seo_description || undefined,
    created_at: row.created_at, updated_at: row.updated_at,
  }) as unknown as Product;

  return {
    data: products.map(buildProduct),
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}
