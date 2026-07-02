import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/cart/validate — validate stock for cart items
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: { product_id: string; variant_id?: string; quantity: number }[] = body.items || [];

    if (items.length === 0) {
      return NextResponse.json({ valid: true, items: [] });
    }

    const results: {
      product_id: string;
      variant_id?: string;
      available: number;
      requested: number;
      in_stock: boolean;
      product_name?: string;
    }[] = [];

    for (const item of items) {
      let available = 0;
      let productName = "";

      if (item.variant_id) {
        // Check variant stock
        const rows = await query<RowDataPacket[]>(
          "SELECT pv.stock, p.name FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ? AND p.is_active = 1",
          [item.variant_id]
        );
        if (rows.length > 0) {
          available = Number(rows[0].stock);
          productName = rows[0].name as string;
        }
      } else {
        // Check product stock
        const rows = await query<RowDataPacket[]>(
          "SELECT stock_quantity, name FROM products WHERE id = ? AND is_active = 1",
          [item.product_id]
        );
        if (rows.length > 0) {
          available = Number(rows[0].stock_quantity);
          productName = rows[0].name as string;
        }
      }

      results.push({
        product_id: item.product_id,
        variant_id: item.variant_id,
        available,
        requested: item.quantity,
        in_stock: available >= item.quantity,
        product_name: productName,
      });
    }

    const allValid = results.every((r) => r.in_stock);

    return NextResponse.json({
      valid: allValid,
      items: results,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
