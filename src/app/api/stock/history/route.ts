import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureInventoryTables } from "@/lib/migrate-inventory";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// GET /api/stock/history?product_id=xxx[&variant_sku=yyy]
// Returns the addition + restock history for a product (optionally scoped to a
// single variant SKU), newest first. Powers the stock-edit slider's history.
export async function GET(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "stock", "view");
    if (denied) return denied;
    await ensureInventoryTables();

    const productId = req.nextUrl.searchParams.get("product_id");
    const variantSku = req.nextUrl.searchParams.get("variant_sku");
    if (!productId) return NextResponse.json({ error: "product_id required" }, { status: 400 });

    let sql = "SELECT id, variant_sku, variant_name, event_type, quantity_change, resulting_stock, note, created_at FROM stock_history WHERE product_id = ?";
    const params: (string | number)[] = [productId];
    if (variantSku) { sql += " AND variant_sku = ?"; params.push(variantSku); }
    sql += " ORDER BY created_at DESC, id DESC LIMIT 100";

    const rows = await query<RowDataPacket[]>(sql, params);
    return NextResponse.json(rows.map((r) => ({
      id: Number(r.id),
      variant_sku: r.variant_sku || null,
      variant_name: r.variant_name || null,
      event_type: r.event_type,
      quantity_change: Number(r.quantity_change),
      resulting_stock: r.resulting_stock == null ? null : Number(r.resulting_stock),
      note: r.note || null,
      created_at: r.created_at,
    })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
