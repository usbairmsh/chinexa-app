import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, parseDbJson } from "@/lib/db";
import { normalizePermissions, canDo, type PermissionAction, type PermissionsMap } from "@/lib/admin-permissions";
import { getVerifiedAdminId } from "@/lib/admin-session";

interface RequesterInfo {
  id: string;
  role: string;
  permissions: PermissionsMap;
}

/**
 * Fetches the calling admin's role+permissions from the DB via the signed
 * chinexa-admin-id session cookie. Returns null if there's no cookie, the
 * signature doesn't verify, or there's no matching active row — callers
 * treat that as "not authenticated as an admin."
 */
export async function getRequester(req: NextRequest): Promise<RequesterInfo | null> {
  const adminId = getVerifiedAdminId(req);
  if (!adminId) return null;
  const rows = await query<RowDataPacket[]>(
    "SELECT role, permissions FROM admin_users WHERE id = ? AND is_active = 1 LIMIT 1",
    [adminId]
  );
  if (rows.length === 0) return null;
  // parseDbJson handles both JSON-typed columns (mysql2 returns objects) and
  // TEXT columns holding JSON (strings) — a bare JSON.parse here silently
  // emptied every regular admin's permissions on JSON-typed schemas.
  const parsed = parseDbJson(rows[0].permissions);
  return { id: adminId, role: rows[0].role as string, permissions: normalizePermissions(parsed) };
}

/**
 * One-line early-return guard for route handlers:
 *   const denied = await requirePermission(req, "products", "delete");
 *   if (denied) return denied;
 */
export async function requirePermission(
  req: NextRequest,
  section: string,
  action: PermissionAction
): Promise<NextResponse | null> {
  const requester = await getRequester(req);
  if (!requester) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDo(requester.role, requester.permissions, section, action)) {
    return NextResponse.json({ error: "You don't have permission to do this" }, { status: 403 });
  }
  return null;
}

/** Superadmin-only guard — replaces ad hoc per-file isSuperadmin() helpers. */
export async function requireSuperadmin(req: NextRequest): Promise<NextResponse | null> {
  const requester = await getRequester(req);
  if (!requester) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (requester.role !== "superadmin") {
    return NextResponse.json({ error: "Only a super admin can do this" }, { status: 403 });
  }
  return null;
}
