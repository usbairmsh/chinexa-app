import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { publicServerError, validationError } from "@/lib/validate";
import { requireSuperadmin } from "@/lib/admin-permissions-server";
import { ensureRolesTable } from "@/lib/migrate-roles";

export async function GET() {
  try {
    await ensureRolesTable();
    const rows = await query<RowDataPacket[]>("SELECT id, name, description, permissions, created_at FROM roles ORDER BY name");
    return NextResponse.json(rows.map((r) => {
      let permissions = {};
      try { permissions = r.permissions ? JSON.parse(r.permissions as string) : {}; } catch { permissions = {}; }
      return { ...r, permissions };
    }));
  } catch (error: unknown) {
    return publicServerError("GET /api/admin-roles", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureRolesTable();
    const denied = await requireSuperadmin(req);
    if (denied) return denied;

    const body = await req.json();
    if (!body.name || !String(body.name).trim()) return validationError("Role name is required");

    const id = `role-${Date.now()}`;
    await execute(
      "INSERT INTO roles (id, name, description, permissions) VALUES (?, ?, ?, ?)",
      [id, String(body.name).trim(), body.description ? String(body.description).trim() : null, JSON.stringify(body.permissions || {})]
    );
    await logActivity("Created role", "role", id, String(body.name).trim());
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return publicServerError("POST /api/admin-roles", error);
  }
}
