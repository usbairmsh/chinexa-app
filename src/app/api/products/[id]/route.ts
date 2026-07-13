import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";
import { deleteUploadedFile } from "@/lib/delete-upload";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { pingIndexNowUrl } from "@/lib/indexnow";
import { getProductBySlugOrId } from "@/lib/products";
import { validate, validationError, dependencyError, publicServerError } from "@/lib/validate";

interface ProductRow extends RowDataPacket { [key: string]: unknown; }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAccountingTables();
    const { id } = await params;
    const product = await getProductBySlugOrId(id);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch (error: unknown) {
    return publicServerError("GET /api/products/[id]", error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "products", "edit");
    if (denied) return denied;
    await ensurePromotionColumns();
    await ensureAccountingTables();
    const { id } = await params;
    const body = await req.json();

    // PUT is a partial update — only validate fields actually present in this
    // request, but cross-field checks (compare_at_price vs price) need the
    // CURRENT row for whichever side of the comparison isn't being changed
    // right now. Previously this route had no validation at all: price could
    // be set to 0/negative, the name blanked out, or a "discount" compare_at_price
    // set below the real price, all via a direct PUT call.
    const currentRows = await query<RowDataPacket[]>("SELECT price, compare_at_price FROM products WHERE id = ? LIMIT 1", [id]);
    if (currentRows.length === 0) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    const current = currentRows[0];

    if (body.name !== undefined) {
      const err = validate([
        { field: "name", value: body.name, rules: ["required", "string", { minLength: 2 }, { maxLength: 255 }], label: "Product name" },
      ]);
      if (err) return validationError(err);
    }
    if (body.price !== undefined) {
      const priceNum = Number(body.price);
      if (!Number.isFinite(priceNum) || priceNum <= 0) {
        return validationError("Price must be greater than zero");
      }
    }
    if (body.stock_quantity !== undefined) {
      const stockNum = Number(body.stock_quantity);
      if (!Number.isFinite(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
        return validationError("Stock quantity must be a non-negative whole number");
      }
    }
    if (body.category_id) {
      const catRows = await query<RowDataPacket[]>("SELECT id FROM categories WHERE id = ?", [body.category_id]);
      if (catRows.length === 0) return dependencyError("Category", body.category_id);
    }
    // Whichever of price/compare_at_price isn't in this request still uses
    // its current DB value, so e.g. lowering just the price below an existing
    // compare_at_price (or raising just compare_at_price above the current
    // price) is caught the same as changing both at once.
    const effectivePrice = body.price !== undefined ? Number(body.price) : Number(current.price);
    const effectiveComparePrice = body.compare_at_price !== undefined
      ? (body.compare_at_price ? Number(body.compare_at_price) : null)
      : (current.compare_at_price ? Number(current.compare_at_price) : null);
    if (effectiveComparePrice !== null && effectiveComparePrice <= effectivePrice) {
      return validationError("Compare-at price must be higher than the selling price");
    }

    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    const map: Record<string, string> = {
      name: "name", price: "price", compare_at_price: "compare_at_price", cost_price: "cost_price", stock_quantity: "stock_quantity",
      min_stock: "min_stock", max_stock: "max_stock",
      description: "description", short_description: "short_description", sku: "sku",
      category_id: "category_id", category_name: "category_name", subcategory: "subcategory",
      brand_id: "brand_id", brand_name: "brand_name",
      is_active: "is_active", is_featured: "is_featured", country_of_origin: "country_of_origin",
      weight: "weight", ingredients: "ingredients", how_to_use: "how_to_use",
      seo_title: "seo_title", seo_description: "seo_description",
    };
    for (const [key, col] of Object.entries(map)) {
      if (body[key] !== undefined) {
        fields.push(`${col} = ?`);
        let val = body[key];
        if (["is_active", "is_featured"].includes(key)) val = val ? 1 : 0;
        // Convert empty strings to null for FK columns
        if (["category_id", "category_name", "subcategory", "brand_id", "brand_name"].includes(key) && val === "") val = null;
        values.push(val);
      }
    }
    if (body.tags) { fields.push("tags = ?"); values.push(JSON.stringify(body.tags)); }
    if (body.badges) { fields.push("badges = ?"); values.push(JSON.stringify(body.badges)); }
    if (body.trust_badges !== undefined) { fields.push("trust_badges = ?"); values.push(JSON.stringify(body.trust_badges)); }
    if (fields.length > 0) {
      values.push(id);
      await execute(`UPDATE products SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    }

    // Update images — delete all and re-insert
    if (body.images && Array.isArray(body.images)) {
      await execute("DELETE FROM product_images WHERE product_id = ?", [id]);
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (img.url) {
          await execute(
            "INSERT INTO product_images (id, product_id, url, alt, `order`) VALUES (?, ?, ?, ?, ?)",
            [`pimg-${id}-${i}`, id, img.url, img.alt || null, i]
          );
        }
      }
    }

    // Update variants — delete all and re-insert
    if (body.variants && Array.isArray(body.variants)) {
      await execute("DELETE FROM product_variants WHERE product_id = ?", [id]);
      for (let i = 0; i < body.variants.length; i++) {
        const v = body.variants[i];
        if (v.name) {
          await execute(
            "INSERT INTO product_variants (id, product_id, name, type, value, hex, price_adjustment, cost_price_adjustment, stock, sku, image, focal_point) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [`pv-${id}-${i}`, id, v.name, v.type || "size", v.value || v.name, v.hex || null, Number(v.price_adjustment) || 0, Number(v.cost_price_adjustment) || 0, Number(v.stock) || 0, v.sku || `${id}-v${i}`, v.image || null, v.focal_point || null]
          );
        }
      }
    }

    await logActivity("Updated product", "product", id);

    // Fire-and-forget — a content/price/stock change is worth a fresh
    // recrawl signal too, not just brand-new products.
    if (body.is_active !== false) {
      const rows = await query<RowDataPacket[]>("SELECT slug FROM products WHERE id = ? LIMIT 1", [id]);
      if (rows[0]?.slug) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
        pingIndexNowUrl(`${siteUrl}/products/${rows[0].slug}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Admin-only route — surface the real error (see POST /api/products for
    // the same reasoning) instead of publicServerError's generic message.
    console.error("[PUT /api/products/[id]]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "products", "delete");
    if (denied) return denied;
    const { id } = await params;
    // Get images and category before deleting
    const product = await query<ProductRow[]>("SELECT category_id FROM products WHERE id = ? LIMIT 1", [id]);
    const categoryId = product[0]?.category_id as string | null;
    const images = await query<RowDataPacket[]>("SELECT url FROM product_images WHERE product_id = ?", [id]);
    const variants = await query<RowDataPacket[]>("SELECT image FROM product_variants WHERE product_id = ? AND image IS NOT NULL", [id]);

    await execute("DELETE FROM products WHERE id = ?", [id]);

    // Clean up image files
    for (const img of images) { await deleteUploadedFile(img.url as string); }
    for (const v of variants) { await deleteUploadedFile(v.image as string); }

    // Update category product count
    if (categoryId) {
      await execute("UPDATE categories SET product_count = (SELECT COUNT(*) FROM products WHERE category_id = ? AND is_active = 1) WHERE id = ?", [categoryId, categoryId]);
    }
    await logActivity("Deleted product", "product", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/products/[id]]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete product" }, { status: 500 });
  }
}
