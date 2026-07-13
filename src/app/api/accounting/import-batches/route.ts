import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query } from "@/lib/db";
import { validate, validationError, dependencyError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { requirePermission } from "@/lib/admin-permissions-server";

export async function GET(req: NextRequest) {
  try {
    await ensureAccountingTables();
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("product_id");
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Math.max(1, Math.min(Number(searchParams.get("page_size")) || 20, 200));

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (productId) { where += " AND product_id = ?"; params.push(productId); }

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM import_batches ${where}`, params);
    const total = Number(countRows[0]?.total) || 0;

    const offset = Math.max(0, (page - 1) * pageSize);
    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM import_batches ${where} ORDER BY batch_date DESC, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return NextResponse.json({
      data: rows.map((r) => ({
        ...r,
        quantity_imported: Number(r.quantity_imported) || 0,
        import_cost_total: Number(r.import_cost_total) || 0,
        shipping_cost: Number(r.shipping_cost) || 0,
        customs_cost: Number(r.customs_cost) || 0,
        other_cost: Number(r.other_cost) || 0,
        landed_cost_per_unit: Number(r.landed_cost_per_unit) || 0,
      })),
      total, page, page_size: pageSize, total_pages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "accounting", "add");
    if (denied) return denied;
    await ensureAccountingTables();
    const body = await req.json();
    const err = validate([
      { field: "product_id", value: body.product_id, rules: ["required", "string"], label: "Product" },
      { field: "quantity_imported", value: Number(body.quantity_imported), rules: ["required", "number", { min: 1 }], label: "Quantity imported" },
      { field: "import_cost_total", value: Number(body.import_cost_total), rules: ["required", "number", "positive"], label: "Import cost" },
      { field: "batch_date", value: body.batch_date, rules: ["required", "string"], label: "Batch date" },
    ]);
    if (err) return validationError(err);

    const productRows = await query<RowDataPacket[]>("SELECT id, name FROM products WHERE id = ?", [body.product_id]);
    if (productRows.length === 0) return dependencyError("Product", body.product_id);

    const quantity = Math.floor(Number(body.quantity_imported));
    const importCost = Number(body.import_cost_total) || 0;
    const shippingCost = Math.max(0, Number(body.shipping_cost) || 0);
    const customsCost = Math.max(0, Number(body.customs_cost) || 0);
    const otherCost = Math.max(0, Number(body.other_cost) || 0);
    const landedCostPerUnit = Math.round(((importCost + shippingCost + customsCost + otherCost) / quantity) * 100) / 100;

    const id = `imp-${Date.now()}`;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(
        "INSERT INTO import_batches (id, product_id, product_name, quantity_imported, import_cost_total, shipping_cost, customs_cost, other_cost, landed_cost_per_unit, batch_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, body.product_id, productRows[0].name, quantity, importCost, shippingCost, customsCost, otherCost, landedCostPerUnit, body.batch_date, body.notes || null]
      );
      // Auto-update the product's cost_price to the newly-computed landed cost
      await conn.execute("UPDATE products SET cost_price = ? WHERE id = ?", [landedCostPerUnit, body.product_id]);
      await conn.commit();
      conn.release();
    } catch (txError) {
      await conn.rollback().catch(() => {});
      conn.release();
      throw txError;
    }

    await logActivity("Recorded import batch — updated cost price", "import_batch", id, `${productRows[0].name} — ৳${landedCostPerUnit}/unit`);

    return NextResponse.json({ success: true, id, landed_cost_per_unit: landedCostPerUnit }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to record import batch" }, { status: 500 });
  }
}
