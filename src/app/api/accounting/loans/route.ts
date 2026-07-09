import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validate, validationError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";

export async function GET() {
  try {
    await ensureAccountingTables();
    const loans = await query<RowDataPacket[]>("SELECT * FROM loans ORDER BY created_at");
    if (loans.length === 0) return NextResponse.json({ data: [] });

    const repayRows = await query<RowDataPacket[]>(
      "SELECT loan_id, type, COALESCE(SUM(amount),0) AS total FROM loan_repayments GROUP BY loan_id, type"
    );
    const totalsByLoan = new Map<string, { principal: number; interest: number }>();
    for (const row of repayRows) {
      const lid = row.loan_id as string;
      const entry = totalsByLoan.get(lid) || { principal: 0, interest: 0 };
      entry[row.type as "principal" | "interest"] = Number(row.total) || 0;
      totalsByLoan.set(lid, entry);
    }

    const data = loans.map((l) => {
      const totals = totalsByLoan.get(l.id as string) || { principal: 0, interest: 0 };
      const principal = Number(l.principal) || 0;
      const dueAmount = Math.max(0, principal - totals.principal);
      return {
        id: l.id, lender_name: l.lender_name, lender_type: l.lender_type,
        principal, interest_rate: Number(l.interest_rate) || 0,
        repayment_type: l.repayment_type, start_date: l.start_date,
        is_active: !!l.is_active, notes: l.notes,
        principal_paid: totals.principal, interest_paid: totals.interest,
        due_amount: dueAmount,
      };
    });

    return NextResponse.json({ data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureAccountingTables();
    const body = await req.json();
    const err = validate([
      { field: "lender_name", value: body.lender_name, rules: ["required", "string", { minLength: 2 }, { maxLength: 255 }], label: "Lender name" },
      { field: "lender_type", value: body.lender_type, rules: ["required", { oneOf: ["bank", "company", "person"] }], label: "Lender type" },
      { field: "principal", value: Number(body.principal), rules: ["required", "number", "positive"], label: "Principal amount" },
      { field: "interest_rate", value: Number(body.interest_rate) || 0, rules: ["number", "positive"], label: "Interest rate" },
      { field: "repayment_type", value: body.repayment_type, rules: ["required", { oneOf: ["installment", "profit_based", "mixed"] }], label: "Repayment type" },
      { field: "start_date", value: body.start_date, rules: ["required", "string"], label: "Start date" },
    ]);
    if (err) return validationError(err);

    const id = `loan-${Date.now()}`;
    await execute(
      "INSERT INTO loans (id, lender_name, lender_type, principal, interest_rate, repayment_type, start_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.lender_name.trim(), body.lender_type, Number(body.principal), Number(body.interest_rate) || 0, body.repayment_type, body.start_date, body.notes || null]
    );
    await logActivity("Added loan", "loan", id, `${body.lender_name} — ৳${Number(body.principal).toLocaleString("en-BD")}`);

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to add loan" }, { status: 500 });
  }
}
