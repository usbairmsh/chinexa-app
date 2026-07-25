import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// GET /api/admin/phones — active admin users that have a phone number, for the
// "which admin number(s) receive order SMS" recipient dropdown in Settings.
// Gated by settings:edit (only whoever configures notifications needs it).
export async function GET(req: NextRequest) {
  try {
    const denied = await requirePermission(req, "settings", "edit");
    if (denied) return denied;

    const rows = await query<RowDataPacket[]>(
      "SELECT id, name, username, phone FROM admin_users WHERE is_active = 1 AND phone IS NOT NULL AND phone <> '' ORDER BY name ASC"
    );
    return NextResponse.json(
      rows.map((r) => ({ id: r.id as string, name: (r.name as string) || (r.username as string) || "Admin", phone: r.phone as string }))
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
