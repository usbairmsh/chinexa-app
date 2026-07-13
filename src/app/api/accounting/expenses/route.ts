import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validate, validationError, dependencyError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { requirePermission } from "@/lib/admin-permissions-server";

export async function GET(req: NextRequest) {
  try {
    await ensureAccountingTables();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const categoryId = searchParams.get("category_id");
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Math.max(1, Math.min(Number(searchParams.get("page_size")) || 20, 200));

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (year) { where += " AND YEAR(expense_date) = ?"; params.push(Number(year)); }
    if (month) { where += " AND MONTH(expense_date) = ?"; params.push(Number(month)); }
    if (categoryId) { where += " AND category_id = ?"; params.push(categoryId); }

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS total_amount FROM expenses ${where}`, params);
    const total = Number(countRows[0]?.total) || 0;
    const totalAmount = Number(countRows[0]?.total_amount) || 0;

    const offset = Math.max(0, (page - 1) * pageSize);
    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM expenses ${where} ORDER BY expense_date DESC, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    return NextResponse.json({
      data: rows.map((r) => ({ ...r, amount: Number(r.amount) || 0 })),
      total, total_amount: totalAmount, page, page_size: pageSize, total_pages: Math.max(1, Math.ceil(total / pageSize)),
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
      { field: "category_id", value: body.category_id, rules: ["required", "string"], label: "Category" },
      { field: "amount", value: Number(body.amount), rules: ["required", "number", "positive"], label: "Amount" },
      { field: "expense_date", value: body.expense_date, rules: ["required", "string"], label: "Expense date" },
    ]);
    if (err) return validationError(err);

    const catRows = await query<RowDataPacket[]>("SELECT name FROM expense_categories WHERE id = ?", [body.category_id]);
    if (catRows.length === 0) return dependencyError("Expense category", body.category_id);

    const id = `exp-${Date.now()}`;
    await execute(
      "INSERT INTO expenses (id, category_id, category_name, amount, description, expense_date, payment_method, receipt_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, body.category_id, catRows[0].name, Number(body.amount), body.description || null, body.expense_date, body.payment_method || null, body.receipt_url || null]
    );
    await logActivity("Recorded expense", "expense", id, `${catRows[0].name} — ৳${Number(body.amount).toLocaleString("en-BD")}`);

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to record expense" }, { status: 500 });
  }
}
