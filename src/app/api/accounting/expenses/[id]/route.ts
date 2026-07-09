import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validationError, dependencyError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAccountingTables();
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.category_id !== undefined) {
      const catRows = await query<RowDataPacket[]>("SELECT name FROM expense_categories WHERE id = ?", [body.category_id]);
      if (catRows.length === 0) return dependencyError("Expense category", body.category_id);
      fields.push("category_id = ?", "category_name = ?");
      values.push(body.category_id, catRows[0].name);
    }
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) return validationError("Amount must be a positive number");
      fields.push("amount = ?");
      values.push(amount);
    }
    if (body.description !== undefined) { fields.push("description = ?"); values.push(body.description || null); }
    if (body.expense_date !== undefined) { fields.push("expense_date = ?"); values.push(body.expense_date); }
    if (body.payment_method !== undefined) { fields.push("payment_method = ?"); values.push(body.payment_method || null); }
    if (body.receipt_url !== undefined) { fields.push("receipt_url = ?"); values.push(body.receipt_url || null); }

    if (fields.length === 0) return NextResponse.json({ success: true });

    values.push(id);
    await execute(`UPDATE expenses SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    await logActivity("Updated expense", "expense", id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAccountingTables();
    const { id } = await params;
    await execute("DELETE FROM expenses WHERE id = ?", [id]);
    await logActivity("Deleted expense", "expense", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
