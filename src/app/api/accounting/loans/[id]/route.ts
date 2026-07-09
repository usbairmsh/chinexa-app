import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validationError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAccountingTables();
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.lender_name !== undefined) {
      if (!body.lender_name || !String(body.lender_name).trim()) return validationError("Lender name is required");
      fields.push("lender_name = ?"); values.push(String(body.lender_name).trim());
    }
    if (body.lender_type !== undefined) {
      if (!["bank", "company", "person"].includes(body.lender_type)) return validationError("Lender type must be bank, company, or person");
      fields.push("lender_type = ?"); values.push(body.lender_type);
    }
    if (body.principal !== undefined) {
      const principal = Number(body.principal);
      if (!Number.isFinite(principal) || principal <= 0) return validationError("Principal must be a positive number");
      fields.push("principal = ?"); values.push(principal);
    }
    if (body.interest_rate !== undefined) { fields.push("interest_rate = ?"); values.push(Number(body.interest_rate) || 0); }
    if (body.repayment_type !== undefined) {
      if (!["installment", "profit_based", "mixed"].includes(body.repayment_type)) return validationError("Repayment type must be installment, profit_based, or mixed");
      fields.push("repayment_type = ?"); values.push(body.repayment_type);
    }
    if (body.start_date !== undefined) { fields.push("start_date = ?"); values.push(body.start_date); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.notes !== undefined) { fields.push("notes = ?"); values.push(body.notes || null); }

    if (fields.length === 0) return NextResponse.json({ success: true });

    values.push(id);
    await execute(`UPDATE loans SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    await logActivity("Updated loan", "loan", id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update loan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAccountingTables();
    const { id } = await params;

    const repayRows = await query<RowDataPacket[]>("SELECT COUNT(*) AS c FROM loan_repayments WHERE loan_id = ?", [id]);
    if (Number(repayRows[0]?.c) > 0) {
      return validationError("This loan has recorded repayments and cannot be deleted. Deactivate it instead.");
    }

    await execute("DELETE FROM loans WHERE id = ?", [id]);
    await logActivity("Deleted loan", "loan", id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
