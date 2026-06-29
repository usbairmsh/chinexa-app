import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

interface ProductRow extends RowDataPacket { id: string; name: string; stock_quantity: number; }
interface ImageRow extends RowDataPacket { url: string; }

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await query<ProductRow[]>(
      "SELECT id, name, stock_quantity FROM products WHERE is_active = 1 AND stock_quantity <= 10 ORDER BY stock_quantity ASC LIMIT 10"
    );

    const result = [];
    for (const p of products) {
      const images = await query<ImageRow[]>("SELECT url FROM product_images WHERE product_id = ? ORDER BY `order` LIMIT 1", [p.id]);
      result.push({
        name: p.name,
        stock: p.stock_quantity,
        image: images[0]?.url || `https://picsum.photos/seed/${p.id}/80/80`,
      });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
