import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST /api/cart/validate — validate stock for cart items
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: { product_id: string; variant_id?: string; quantity: number }[] = body.items || [];

    if (items.length === 0) {
      return NextResponse.json({ valid: true, items: [] });
    }

    // Batch the stock lookups into two queries (variants, plain products)
    // instead of one round-trip per cart line item.
    const variantItems = items.filter((i): i is typeof i & { variant_id: string } => !!i.variant_id);
    const plainItems = items.filter((i) => !i.variant_id);

    const [variantRows, productRows] = await Promise.all([
      variantItems.length > 0
        ? query<RowDataPacket[]>(
            `SELECT pv.id AS variant_id, pv.stock, p.name FROM product_variants pv
             JOIN products p ON p.id = pv.product_id
             WHERE pv.id IN (${variantItems.map(() => "?").join(",")}) AND p.is_active = 1`,
            variantItems.map((i) => i.variant_id)
          )
        : Promise.resolve([] as RowDataPacket[]),
      plainItems.length > 0
        ? query<RowDataPacket[]>(
            `SELECT id, stock_quantity, name FROM products WHERE id IN (${plainItems.map(() => "?").join(",")}) AND is_active = 1`,
            plainItems.map((i) => i.product_id)
          )
        : Promise.resolve([] as RowDataPacket[]),
    ]);

    const byVariantId = new Map(variantRows.map((r) => [r.variant_id as string, r]));
    const byProductId = new Map(productRows.map((r) => [r.id as string, r]));

    const results = items.map((item) => {
      let available = 0;
      let productName = "";
      if (item.variant_id) {
        const row = byVariantId.get(item.variant_id);
        if (row) { available = Number(row.stock); productName = row.name as string; }
      } else {
        const row = byProductId.get(item.product_id);
        if (row) { available = Number(row.stock_quantity); productName = row.name as string; }
      }
      return {
        product_id: item.product_id,
        variant_id: item.variant_id,
        available,
        requested: item.quantity,
        in_stock: available >= item.quantity,
        product_name: productName,
      };
    });

    const allValid = results.every((r) => r.in_stock);

    return NextResponse.json({
      valid: allValid,
      items: results,
    });
  } catch (error: unknown) {
    return publicServerError("POST /api/cart/validate", error);
  }
}
