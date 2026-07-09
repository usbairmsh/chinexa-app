import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

interface ProductRow extends RowDataPacket { id: string; name: string; stock_quantity: number; }
interface ImageRow extends RowDataPacket { product_id: string; url: string; order: number; }

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await query<ProductRow[]>(
      "SELECT id, name, stock_quantity FROM products WHERE is_active = 1 AND stock_quantity <= 10 ORDER BY stock_quantity ASC LIMIT 10"
    );

    if (products.length === 0) return NextResponse.json([]);

    // One batched query for every product's first image instead of one
    // query per row — first image per product picked in JS (images arrive
    // pre-sorted by `order`, same convention as products/route.ts's buildProduct()).
    const placeholders = products.map(() => "?").join(",");
    const images = await query<ImageRow[]>(
      `SELECT product_id, url, \`order\` FROM product_images WHERE product_id IN (${placeholders}) ORDER BY \`order\``,
      products.map((p) => p.id)
    );
    const firstImageByProduct = new Map<string, string>();
    for (const img of images) {
      if (!firstImageByProduct.has(img.product_id)) firstImageByProduct.set(img.product_id, img.url);
    }

    const result = products.map((p) => ({
      name: p.name,
      stock: p.stock_quantity,
      image: firstImageByProduct.get(p.id) || `https://picsum.photos/seed/${p.id}/80/80`,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
