import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { validationError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { requirePermission } from "@/lib/admin-permissions-server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "accounting", "edit");
    if (denied) return denied;
    await ensureAccountingTables();
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.name !== undefined) {
      if (!body.name || !String(body.name).trim()) return validationError("Category name is required");
      fields.push("name = ?");
      values.push(String(body.name).trim());
    }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(Number(body.sort_order) || 0); }

    if (fields.length === 0) return NextResponse.json({ success: true });

    values.push(id);
    await execute(`UPDATE expense_categories SET ${fields.join(", ")} WHERE id = ?`, values);
    await logActivity("Updated expense category", "expense_category", id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Duplicate entry")) return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    console.error("[PATCH /api/accounting/expense-categories/[id]]", error);
    return NextResponse.json({ error: message || "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "accounting", "delete");
    if (denied) return denied;
    await ensureAccountingTables();
    const { id } = await params;

    const activeRows = await query<RowDataPacket[]>("SELECT COUNT(*) AS c FROM expense_categories WHERE is_active = TRUE");
    const activeCount = Number(activeRows[0]?.c) || 0;
    const thisRows = await query<RowDataPacket[]>("SELECT is_active FROM expense_categories WHERE id = ? LIMIT 1", [id]);
    if (thisRows.length === 0) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    if (thisRows[0].is_active && activeCount <= 1) {
      return validationError("Cannot deactivate the last active expense category");
    }

    // Soft delete only — expenses.category_id has ON DELETE RESTRICT, and
    // historical expense rows must keep their category reference intact.
    await execute("UPDATE expense_categories SET is_active = FALSE WHERE id = ?", [id]);
    await logActivity("Deactivated expense category", "expense_category", id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
