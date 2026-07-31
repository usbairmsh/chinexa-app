import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, parseDbJson } from "@/lib/db";
import { normalizePermissions, canDo, hasFullAccess, canAccessMailbox, getMailboxScope, mailboxScopeUnset, type PermissionAction, type PermissionsMap } from "@/lib/admin-permissions";
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
  if (!hasFullAccess(requester.role)) {
    return NextResponse.json({ error: "Only a super admin can do this" }, { status: 403 });
  }
  return null;
}

/**
 * The set of mailbox ids the caller may access in the Email Center.
 * Returns "all" for full-access roles (no filtering), otherwise the admin's
 * per-mailbox scope list (may be empty → no access to any mailbox).
 * Returns null when the caller isn't an authenticated admin.
 */
export async function scopedMailboxIds(req: NextRequest): Promise<string[] | "all" | null> {
  const requester = await getRequester(req);
  if (!requester) return null;
  if (hasFullAccess(requester.role)) return "all";
  // Legacy admins whose scope was never set keep access to all mailboxes until
  // a superadmin narrows it (no lockout on deploy).
  if (mailboxScopeUnset(requester.permissions)) return "all";
  return getMailboxScope(requester.permissions);
}

/**
 * Guard for a specific mailbox: the caller must both hold the email_inbox
 * `action` AND be scoped to `mailboxId`. Returns a NextResponse to short-circuit
 * (401/403/404), or null when allowed. Uses 404 for out-of-scope mailboxes so
 * their existence isn't leaked to an unauthorized admin.
 */
export async function requireMailboxAccess(
  req: NextRequest,
  mailboxId: string,
  action: PermissionAction
): Promise<NextResponse | null> {
  const requester = await getRequester(req);
  if (!requester) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canDo(requester.role, requester.permissions, "email_inbox", action)) {
    return NextResponse.json({ error: "You don't have permission to do this" }, { status: 403 });
  }
  if (!canAccessMailbox(requester.role, requester.permissions, mailboxId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
