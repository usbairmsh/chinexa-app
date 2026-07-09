import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validate, validationError, dependencyError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";

// Financial event history — corrections happen via a new offsetting
// transaction (standard accounting practice), not by editing/deleting past
// records, so this route intentionally has no PATCH/DELETE.

export async function GET(req: NextRequest) {
  try {
    await ensureAccountingTables();
    const { searchParams } = new URL(req.url);
    const loanId = searchParams.get("loan_id");

    let where = "WHERE 1=1";
    const params: string[] = [];
    if (loanId) { where += " AND lr.loan_id = ?"; params.push(loanId); }

    const rows = await query<RowDataPacket[]>(
      `SELECT lr.*, l.lender_name FROM loan_repayments lr
       JOIN loans l ON l.id = lr.loan_id ${where}
       ORDER BY lr.repayment_date DESC, lr.created_at DESC`,
      params
    );

    return NextResponse.json({ data: rows.map((r) => ({ ...r, amount: Number(r.amount) || 0 })) });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureAccountingTables();
    const body = await req.json();
    const err = validate([
      { field: "loan_id", value: body.loan_id, rules: ["required", "string"], label: "Loan" },
      { field: "type", value: body.type, rules: ["required", { oneOf: ["principal", "interest"] }], label: "Repayment type" },
      { field: "amount", value: Number(body.amount), rules: ["required", "number", "positive"], label: "Amount" },
      { field: "repayment_date", value: body.repayment_date, rules: ["required", "string"], label: "Repayment date" },
    ]);
    if (err) return validationError(err);

    const loanRows = await query<RowDataPacket[]>("SELECT id FROM loans WHERE id = ?", [body.loan_id]);
    if (loanRows.length === 0) return dependencyError("Loan", body.loan_id);

    const id = `lrepay-${Date.now()}`;
    await execute(
      "INSERT INTO loan_repayments (id, loan_id, type, amount, repayment_date, note) VALUES (?, ?, ?, ?, ?, ?)",
      [id, body.loan_id, body.type, Number(body.amount), body.repayment_date, body.note || null]
    );
    await logActivity(`Recorded loan ${body.type} repayment`, "loan_repayment", id, `৳${Number(body.amount).toLocaleString("en-BD")}`);

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to record repayment" }, { status: 500 });
  }
}
