import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureAccountingTables } from "@/lib/migrate-accounting";

interface CostRow extends RowDataPacket { id: string; cost_price: number; }
interface VariantCostRow extends RowDataPacket { id: string; cost_price_adjustment: number; }

// Admin-only lookup for a product's cost_price / per-variant cost_price_adjustment
// (internal margin data) — split out of the shared GET /api/products/[id]
// response so those numbers are never returned to public/storefront callers.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAccountingTables();
    const { id } = await params;

    const products = await query<CostRow[]>("SELECT id, cost_price FROM products WHERE slug = ? OR id = ? LIMIT 1", [id, id]);
    if (products.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const variants = await query<VariantCostRow[]>(
      "SELECT id, cost_price_adjustment FROM product_variants WHERE product_id = ?",
      [products[0].id]
    );

    return NextResponse.json({
      cost_price: Number(products[0].cost_price) || 0,
      variants: variants.map((v) => ({ id: v.id, cost_price_adjustment: Number(v.cost_price_adjustment) || 0 })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
