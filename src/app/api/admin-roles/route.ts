import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute, parseDbJson } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { publicServerError, validationError } from "@/lib/validate";
import { requireSuperadmin } from "@/lib/admin-permissions-server";
import { ensureRolesTable } from "@/lib/migrate-roles";

export async function GET() {
  try {
    await ensureRolesTable();
    const rows = await query<RowDataPacket[]>("SELECT id, name, description, permissions, created_at FROM roles ORDER BY name");
    return NextResponse.json(rows.map((r) => {
      // roles.permissions is a JSON-typed column, so mysql2 hands back an
      // already-parsed object — the old bare JSON.parse() choked on it and
      // silently returned {} for every role ("role access not storing").
      return { ...r, permissions: parseDbJson(r.permissions) ?? {} };
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
    // Superadmin-gated (requireSuperadmin above) — surface the real error.
    console.error("[POST /api/admin-roles]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create role" }, { status: 500 });
  }
}
