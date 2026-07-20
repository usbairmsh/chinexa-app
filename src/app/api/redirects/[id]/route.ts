import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { requirePermission } from "@/lib/admin-permissions-server";
import { ensureRedirectsTable } from "@/lib/redirects";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "seo", "edit");
    if (denied) return denied;
    await ensureRedirectsTable();
    const { id } = await params;
    const body = await req.json();
    if (typeof body.is_active === "boolean") {
      await execute("UPDATE redirects SET is_active = ? WHERE id = ?", [body.is_active ? 1 : 0, Number(id)]);
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "seo", "edit");
    if (denied) return denied;
    await ensureRedirectsTable();
    const { id } = await params;
    await execute("DELETE FROM redirects WHERE id = ?", [Number(id)]);
    await logActivity("Deleted URL redirect", "settings", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
