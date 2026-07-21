import { query, execute } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { SYSTEM_ADMIN_ROLE, hasFullAccess } from "@/lib/admin-permissions";
import { ensureSystemAdminRole } from "@/lib/migrate-system-admin";

// The identity + access facts about an admin, resolved WITH delegation and
// expiry applied. Every management guard reasons about these, not the raw role.
export interface AdminAccess {
  id: string;
  role: string;
  /** The permanent, pinned owner — role === 'system_admin'. Exactly one. */
  isRealSystemAdmin: boolean;
  /** Currently holds system-admin powers by delegation (and not expired). */
  isDelegate: boolean;
  /** Real OR active delegate — has system-admin-level authority right now. */
  isSystemAdminEffective: boolean;
  /** Full unrestricted access (system admin — real or delegate — or superadmin). */
  fullAccess: boolean;
}

/**
 * Resolve an admin's effective access, lazily expiring stale delegations.
 * A time-limited delegation whose system_admin_until has passed is cleared on
 * read (the delegate silently reverts to their underlying role), so expiry is
 * enforced without a cron — the first request after expiry undoes it.
 */
export async function getAdminAccess(id: string): Promise<AdminAccess | null> {
  await ensureSystemAdminRole();
  const rows = await query<RowDataPacket[]>(
    "SELECT id, role, system_admin_delegated, system_admin_until FROM admin_users WHERE id = ? LIMIT 1",
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  const role = r.role as string;
  const isRealSystemAdmin = role === SYSTEM_ADMIN_ROLE;

  let delegated = !!r.system_admin_delegated;
  const until = r.system_admin_until ? new Date(r.system_admin_until as string) : null;
  if (delegated && until && until.getTime() <= Date.now()) {
    // Expired — clear it so the delegate reverts to their underlying role.
    await execute(
      "UPDATE admin_users SET system_admin_delegated = 0, system_admin_until = NULL WHERE id = ?",
      [id]
    ).catch(() => {});
    delegated = false;
  }

  const isDelegate = delegated && !isRealSystemAdmin;
  const isSystemAdminEffective = isRealSystemAdmin || isDelegate;
  const fullAccess = isSystemAdminEffective || hasFullAccess(role);

  return { id, role, isRealSystemAdmin, isDelegate, isSystemAdminEffective, fullAccess };
}
