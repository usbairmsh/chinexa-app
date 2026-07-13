import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validate, validationError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { requirePermission } from "@/lib/admin-permissions-server";

export async function GET() {
  try {
    await ensureAccountingTables();
    const rows = await query<RowDataPacket[]>(
      "SELECT id, name, is_active, sort_order FROM expense_categories ORDER BY sort_order, name"
    );
    return NextResponse.json({
      data: rows.map((r) => ({ id: r.id, name: r.name, is_active: !!r.is_active, sort_order: Number(r.sort_order) || 0 })),
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
      { field: "name", value: body.name, rules: ["required", "string", { minLength: 2 }, { maxLength: 100 }], label: "Category name" },
    ]);
    if (err) return validationError(err);

    const id = `cat-${Date.now()}`;
    const maxSortRows = await query<RowDataPacket[]>("SELECT COALESCE(MAX(sort_order), 0) AS m FROM expense_categories");
    const sortOrder = (Number(maxSortRows[0]?.m) || 0) + 1;

    await execute("INSERT INTO expense_categories (id, name, sort_order) VALUES (?, ?, ?)", [id, body.name.trim(), sortOrder]);
    await logActivity("Added expense category", "expense_category", id, body.name);

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Duplicate entry")) return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
