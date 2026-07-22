import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";
import { validate, validationError, dependencyError, publicServerError } from "@/lib/validate";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { ensureSearchIndexes } from "@/lib/migrate-search";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { pingIndexNowUrl } from "@/lib/indexnow";
import { getProductsList } from "@/lib/products";
import { ensurePreorderColumns } from "@/lib/migrate-preorder";
import { ensureInventoryTables, recordStockHistory } from "@/lib/migrate-inventory";
import { ensureCardBadgeColumn } from "@/lib/migrate-card-badges";

interface ProductRow extends RowDataPacket {
  id: string; name: string; slug: string; description: string; short_description: string;
  sku: string; price: number; compare_at_price: number | null; cost_price: number | null; currency: string;
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
  hex: string | null; price_adjustment: number; cost_price_adjustment: number; stock: number; sku: string;
}

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
    hidden_card_badges: typeof row.hidden_card_badges === "string" ? JSON.parse(row.hidden_card_badges || "[]") : (row.hidden_card_badges || []),
    variants: variants.filter((v) => v.product_id === row.id).map((v) => ({
      id: v.id, name: v.name, type: v.type as "size" | "color" | "shade" | "weight",
      value: v.value, hex: v.hex || undefined,
      price_adjustment: Number(v.price_adjustment), stock: v.stock, sku: v.sku,
      image: v.image || undefined,
    })),
    stock_quantity: row.stock_quantity, is_active: !!row.is_active, is_featured: !!row.is_featured,
    last_restocked_at: row.last_restocked_at || undefined,
    oos_wishlist_count: Number(row.oos_wishlist_count) || 0,
    average_rating: Number(row.average_rating), review_count: row.review_count,
    country_of_origin: row.country_of_origin || undefined, weight: row.weight || undefined,
    ingredients: row.ingredients || undefined, how_to_use: row.how_to_use || undefined,
    trust_badges: typeof row.trust_badges === "string" ? JSON.parse(row.trust_badges || "[]") : row.trust_badges || [],
    seo_title: row.seo_title || undefined, seo_description: row.seo_description || undefined,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    await ensureSearchIndexes();
    await ensureAccountingTables();
    await ensureInventoryTables();
    await ensureCardBadgeColumn();
    const { searchParams } = new URL(req.url);

    // Batched lookup by id list (e.g. wishlist page) — bypasses pagination/
    // filtering entirely, just returns whichever of these ids exist.
    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
      if (ids.length === 0) return NextResponse.json({ data: [] });
      const placeholders = ids.map(() => "?").join(",");
      const products = await query<ProductRow[]>(`SELECT * FROM products p WHERE p.id IN (${placeholders})`, ids);
      if (products.length === 0) return NextResponse.json({ data: [] });
      const foundIds = products.map((p) => p.id);
      const idPlaceholders = foundIds.map(() => "?").join(",");
      const [images, variants] = await Promise.all([
        query<ImageRow[]>(`SELECT * FROM product_images WHERE product_id IN (${idPlaceholders}) ORDER BY \`order\``, foundIds),
        query<VariantRow[]>(`SELECT * FROM product_variants WHERE product_id IN (${idPlaceholders})`, foundIds),
      ]);
      return NextResponse.json({ data: products.map((p) => buildProduct(p, images, variants)) });
    }

    const result = await getProductsList(searchParams);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return publicServerError("GET /api/products", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "products", "add");
    if (denied) return denied;
    await ensurePromotionColumns();
    await ensureAccountingTables();
    await ensurePreorderColumns();
    await ensureInventoryTables();
    await ensureCardBadgeColumn();
    const body = await req.json();

    // Validate required fields
    const err = validate([
      { field: "name", value: body.name, rules: ["required", "string", { minLength: 2 }, { maxLength: 255 }], label: "Product name" },
      { field: "price", value: Number(body.price), rules: ["required", "number", "positive"], label: "Price" },
    ]);
    if (err) return validationError(err);
    // "positive" alone allows 0 — a real product must have a price greater than zero.
    if (!(Number(body.price) > 0)) {
      return validationError("Price must be greater than zero");
    }
    if (body.stock_quantity !== undefined) {
      const stockNum = Number(body.stock_quantity);
      if (!Number.isFinite(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
        return validationError("Stock quantity must be a non-negative whole number");
      }
    }

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
      `INSERT INTO products (id, name, slug, description, short_description, sku, price, compare_at_price, cost_price, currency, category_id, category_name, subcategory, brand_id, brand_name, tags, badges, hidden_card_badges, trust_badges, stock_quantity, min_stock, max_stock, preorder_release_date, is_active, is_featured, country_of_origin, weight, ingredients, how_to_use, seo_title, seo_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'BDT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, body.name, slug,
        body.description || "", body.short_description || "",
        sku, Number(body.price) || 0, body.compare_at_price ? Number(body.compare_at_price) : null,
        Number(body.cost_price) || 0,
        body.category_id || null, body.category_name || body.category_id || "",
        body.subcategory || null,
        body.brand_id || null, body.brand_name || null,
        JSON.stringify(body.tags || []), JSON.stringify(body.badges || []),
        JSON.stringify(body.hidden_card_badges || []),
        JSON.stringify(body.trust_badges || []),
        Number(body.stock_quantity) || 0, Number(body.min_stock) || 10, Number(body.max_stock) || 100,
        body.preorder_release_date || null,
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
          const variantSku = v.sku || `${sku}-${i}`;
          const variantStock = Number(v.stock) || 0;
          await query(
            "INSERT INTO product_variants (id, product_id, name, type, value, hex, price_adjustment, cost_price_adjustment, stock, sku, image, focal_point) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [`v-${id}-${i}`, id, v.name, v.type || "size", v.value || v.name, v.hex || null, Number(v.price_adjustment) || 0, Number(v.cost_price_adjustment) || 0, variantStock, variantSku, v.image || null, v.focal_point || null]
          );
          // "Product addition" history — the initial stock of each variant.
          await recordStockHistory({ productId: id, variantSku, variantName: v.name, eventType: "added", quantityChange: variantStock, resultingStock: variantStock, note: "Product created" });
        }
      }
    } else {
      // No variants — log the product-level initial stock as the addition event.
      await recordStockHistory({ productId: id, eventType: "added", quantityChange: Number(body.stock_quantity) || 0, resultingStock: Number(body.stock_quantity) || 0, note: "Product created" });
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
    // Admin-only route — surface the real error (matches the pattern used by
    // every other admin CRUD route, e.g. categories/coupons/banners) instead
    // of a generic message that hides which field/constraint actually failed.
    console.error("[POST /api/products]", error);
    return NextResponse.json({ error: message || "Failed to create product" }, { status: 500 });
  }
}
