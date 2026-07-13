import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validate, validationError, dependencyError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { requirePermission } from "@/lib/admin-permissions-server";

// Financial event history — corrections happen via a new offsetting
// transaction (standard accounting practice), not by editing/deleting past
// records, so this route intentionally has no PATCH/DELETE.

export async function GET(req: NextRequest) {
  try {
    await ensureAccountingTables();
    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get("partner_id");

    let where = "WHERE 1=1";
    const params: string[] = [];
    if (partnerId) { where += " AND pt.partner_id = ?"; params.push(partnerId); }

    const rows = await query<RowDataPacket[]>(
      `SELECT pt.*, p.name AS partner_name FROM partner_transactions pt
       JOIN partners p ON p.id = pt.partner_id ${where}
       ORDER BY pt.transaction_date DESC, pt.created_at DESC`,
      params
    );

    return NextResponse.json({ data: rows.map((r) => ({ ...r, amount: Number(r.amount) || 0 })) });
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
      { field: "partner_id", value: body.partner_id, rules: ["required", "string"], label: "Partner" },
      { field: "type", value: body.type, rules: ["required", { oneOf: ["investment", "withdrawal", "profit_distribution"] }], label: "Transaction type" },
      { field: "amount", value: Number(body.amount), rules: ["required", "number", "positive"], label: "Amount" },
      { field: "transaction_date", value: body.transaction_date, rules: ["required", "string"], label: "Transaction date" },
    ]);
    if (err) return validationError(err);

    const partnerRows = await query<RowDataPacket[]>("SELECT id FROM partners WHERE id = ?", [body.partner_id]);
    if (partnerRows.length === 0) return dependencyError("Partner", body.partner_id);

    const id = `ptxn-${Date.now()}`;
    await execute(
      "INSERT INTO partner_transactions (id, partner_id, type, amount, transaction_date, note) VALUES (?, ?, ?, ?, ?, ?)",
      [id, body.partner_id, body.type, Number(body.amount), body.transaction_date, body.note || null]
    );
    await logActivity(`Recorded partner ${body.type}`, "partner_transaction", id, `৳${Number(body.amount).toLocaleString("en-BD")}`);

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to record transaction" }, { status: 500 });
  }
}
