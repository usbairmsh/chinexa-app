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
      if (!body.name || !String(body.name).trim()) return validationError("Partner name is required");
      fields.push("name = ?"); values.push(String(body.name).trim());
    }
    if (body.email !== undefined) { fields.push("email = ?"); values.push(body.email || null); }
    if (body.phone !== undefined) { fields.push("phone = ?"); values.push(body.phone || null); }
    if (body.initial_investment !== undefined) { fields.push("initial_investment = ?"); values.push(Number(body.initial_investment) || 0); }
    if (body.share_percentage !== undefined) {
      const pct = Number(body.share_percentage);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return validationError("Share percentage must be between 0 and 100");
      fields.push("share_percentage = ?"); values.push(pct);
    }
    if (body.join_date !== undefined) { fields.push("join_date = ?"); values.push(body.join_date); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.notes !== undefined) { fields.push("notes = ?"); values.push(body.notes || null); }

    if (fields.length === 0) return NextResponse.json({ success: true });

    values.push(id);
    await execute(`UPDATE partners SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    await logActivity("Updated partner", "partner", id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update partner" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "accounting", "delete");
    if (denied) return denied;
    await ensureAccountingTables();
    const { id } = await params;

    const txnRows = await query<RowDataPacket[]>("SELECT COUNT(*) AS c FROM partner_transactions WHERE partner_id = ?", [id]);
    if (Number(txnRows[0]?.c) > 0) {
      return validationError("This partner has recorded transactions and cannot be deleted. Deactivate them instead.");
    }

    await execute("DELETE FROM partners WHERE id = ?", [id]);
    await logActivity("Deleted partner", "partner", id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
