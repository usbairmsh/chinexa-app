import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validationError } from "@/lib/validate";
import { requireSuperadmin } from "@/lib/admin-permissions-server";
import { ensureRolesTable } from "@/lib/migrate-roles";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureRolesTable();
    const denied = await requireSuperadmin(req);
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json();
    if (!body.name || !String(body.name).trim()) return validationError("Role name is required");

    await execute(
      "UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?",
      [String(body.name).trim(), body.description ? String(body.description).trim() : null, JSON.stringify(body.permissions || {}), id]
    );
    await logActivity("Updated role", "role", id, String(body.name).trim());
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Superadmin-gated (requireSuperadmin above) — surface the real error.
    console.error("[PUT /api/admin-roles/[id]]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureRolesTable();
    const denied = await requireSuperadmin(req);
    if (denied) return denied;

    const { id } = await params;
    // Roles are copy-on-select presets — admin_users has no FK to roles, so
    // deleting a role never affects any admin who already picked it as a
    // starting point; no cascading cleanup needed.
    await execute("DELETE FROM roles WHERE id = ?", [id]);
    await logActivity("Deleted role", "role", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Superadmin-gated (requireSuperadmin above) — surface the real error.
    console.error("[DELETE /api/admin-roles/[id]]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete role" }, { status: 500 });
  }
}
