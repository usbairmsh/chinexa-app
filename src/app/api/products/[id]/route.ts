import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { deleteUploadedFile } from "@/lib/delete-upload";

interface ProductRow extends RowDataPacket { [key: string]: unknown; }
interface ImageRow extends RowDataPacket { id: string; product_id: string; url: string; alt: string; order: number; }
interface VariantRow extends RowDataPacket { id: string; product_id: string; name: string; type: string; value: string; hex: string | null; price_adjustment: number; stock: number; sku: string; }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Try by slug first, then by id
    const products = await query<ProductRow[]>(
      "SELECT * FROM products WHERE slug = ? OR id = ? LIMIT 1",
      [id, id]
    );
    if (products.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const product = products[0];
    const images = await query<ImageRow[]>("SELECT * FROM product_images WHERE product_id = ? ORDER BY `order`", [product.id as string]);
    const variants = await query<VariantRow[]>("SELECT * FROM product_variants WHERE product_id = ?", [product.id as string]);

    return NextResponse.json({
      ...product,
      price: Number(product.price),
      compare_at_price: product.compare_at_price ? Number(product.compare_at_price) : undefined,
      is_active: !!product.is_active,
      is_featured: !!product.is_featured,
      average_rating: Number(product.average_rating),
      tags: typeof product.tags === "string" ? JSON.parse(product.tags || "[]") : product.tags || [],
      badges: typeof product.badges === "string" ? JSON.parse(product.badges || "[]") : product.badges || [],
      images: images.map((i) => ({ id: i.id, url: i.url, alt: i.alt || "", order: i.order })),
      variants: variants.map((v) => ({ id: v.id, name: v.name, type: v.type, value: v.value, hex: v.hex || undefined, price_adjustment: Number(v.price_adjustment), stock: v.stock, sku: v.sku, image: v.image || undefined, focal_point: v.focal_point || undefined })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    const map: Record<string, string> = {
      name: "name", price: "price", compare_at_price: "compare_at_price", stock_quantity: "stock_quantity",
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
            "INSERT INTO product_variants (id, product_id, name, type, value, hex, price_adjustment, stock, sku, image, focal_point) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [`pv-${id}-${i}`, id, v.name, v.type || "size", v.value || v.name, v.hex || null, Number(v.price_adjustment) || 0, Number(v.stock) || 0, v.sku || `${id}-v${i}`, v.image || null, v.focal_point || null]
          );
        }
      }
    }

    await logActivity("Updated product", "product", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
