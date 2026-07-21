import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute, parseDbJson } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { normalizePermissions, hasFullAccess, SYSTEM_ADMIN_ROLE } from "@/lib/admin-permissions";
import { createAdminSessionToken, getVerifiedAdminId } from "@/lib/admin-session";
import { ensureSystemAdminRole } from "@/lib/migrate-system-admin";
import { getAdminAccess, type AdminAccess } from "@/lib/system-admin";

// Chain of command for admin management (delete / deactivate / edit / demote),
// delegation-aware:
//   • real system admin   — top of the chain; can act on every OTHER admin.
//   • delegated system admin — same broad powers, EXCEPT can never act on the
//     real system admin (that's the "delegate can't remove the owner" rule).
//   • superadmin          — regular admins only.
// Returns an error string if the requester may not manage the target, else null.
// Self-actions are gated separately by each caller.
function chainViolation(requester: AdminAccess, targetId: string, target: AdminAccess | null): string | null {
  if (targetId === requester.id) return null; // self-actions handled per-caller

  // The real system admin is untouchable by anyone but themselves — including
  // a delegate. This is the core guarantee: a delegated system admin can never
  // remove/deactivate/demote/edit the real owner.
  if (target?.isRealSystemAdmin) {
    return "The system administrator can only be managed by themselves";
  }
  // Only an effective system admin (real or delegate) may manage a super admin
  // or another delegate; a plain super admin cannot.
  const targetIsHigh = target?.role === "superadmin" || target?.isDelegate;
  if (targetIsHigh && !requester.isSystemAdminEffective) {
    return "Only the system administrator can manage a super admin";
  }
  return null;
}

// Admin credentials guard the whole store — cap login attempts per
// username+IP so a password can't just be ground through with unlimited
// guesses.
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    await ensureSystemAdminRole();
    const body = await req.json();
    const { action } = body;
    // The acting admin's identity must come from the signed session cookie
    // the browser sends automatically, never from body.requester_id (fully
    // client-controlled) and never from the raw cookie value alone (that used
    // to be just the admin's plain database id, which any client-side JS
    // could rewrite via document.cookie to impersonate a different admin —
    // see admin-session.ts). getVerifiedAdminId() only returns an id whose
    // HMAC signature actually matches, so a tampered/forged cookie yields null.
    const requesterId = getVerifiedAdminId(req);

    // ─── LOGIN ───
    if (action === "login") {
      const { username, password, remember_me } = body;
      if (!username || !password) return NextResponse.json({ error: "Username and password are required" }, { status: 400 });

      const ip = getClientIp(req);
      const byUser = checkRateLimit(`admin-login:user:${username}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
      const byIp = checkRateLimit(`admin-login:ip:${ip}`, LOGIN_MAX_ATTEMPTS * 3, LOGIN_WINDOW_MS);
      if (byUser.limited || byIp.limited) {
        return NextResponse.json({ error: "Too many login attempts. Please wait a few minutes and try again." }, { status: 429 });
      }

      const rows = await query<RowDataPacket[]>(
        "SELECT * FROM admin_users WHERE username = ? AND is_active = 1 LIMIT 1", [username]
      );
      if (rows.length === 0) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

      const admin = rows[0];
      const valid = await bcrypt.compare(password, admin.password as string);
      if (!valid) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

      // Update last_login. Login itself is intentionally NOT written to the
      // activity log — it's routine self-activity, not an admin action worth
      // auditing, and would drown out the meaningful entries. last_login on
      // the user row already records when each admin last signed in.
      await execute("UPDATE admin_users SET last_login = NOW() WHERE id = ?", [admin.id]);

      const res = NextResponse.json({
        success: true,
        user: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          role: admin.role,
        },
      });

      // The session cookie is now set here (server-side, httpOnly) instead of
      // the login page writing document.cookie — httpOnly means client-side
      // JS (and therefore an attacker's injected script, or someone just
      // opening devtools) can no longer read or rewrite it, and its value is
      // a signed token (see admin-session.ts), not the raw admin id, so it
      // can't be forged to impersonate a different admin either.
      res.cookies.set("chinexa-admin-id", createAdminSessionToken(admin.id as string), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: remember_me ? 7 * 24 * 60 * 60 : undefined,
      });
      // Display-only, non-sensitive — still readable client-side so the admin
      // shell can show a name/role badge without an extra round trip.
      res.cookies.set("chinexa-role", admin.role as string, {
        path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production",
        maxAge: remember_me ? 7 * 24 * 60 * 60 : undefined,
      });
      res.cookies.set("chinexa-admin-name", encodeURIComponent(admin.name as string), {
        path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production",
        maxAge: remember_me ? 7 * 24 * 60 * 60 : undefined,
      });
      return res;
    }

    // ─── ADD ADMIN (superadmin only) ───
    if (action === "add_admin") {
      const { username, password, name, email, phone, role } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // Requester must have full access (system admin — real or delegate — or
      // super admin).
      const addRequester = await getAdminAccess(requesterId);
      if (!addRequester || !addRequester.fullAccess) {
        return NextResponse.json({ error: "Only a super admin can add new admins" }, { status: 403 });
      }

      if (!username || !password || !name) return NextResponse.json({ error: "Username, password, and name are required" }, { status: 400 });
      if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      if (password.length > 128) return NextResponse.json({ error: "Password must be at most 128 characters" }, { status: 400 });

      // The system administrator is a single, permanent, pre-pinned account —
      // no new one can ever be created through this route. Anything that isn't
      // a plain superadmin becomes a regular admin.
      const newRole = role === "superadmin" ? "superadmin" : "admin";

      const hashed = await bcrypt.hash(password, 10);
      const id = `adm-${Date.now()}`;
      const perms = body.permissions ? JSON.stringify(body.permissions) : null;
      await execute(
        "INSERT INTO admin_users (id, username, password, name, email, phone, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, username, hashed, name, email || null, phone || null, newRole, perms]
      );
      await logActivity("Added new admin", "admin", id, `${name} (${username})`, requesterId);

      return NextResponse.json({ success: true, id }, { status: 201 });
    }

    // ─── UPDATE ADMIN (superadmin only) — edits an existing admin's identity
    // fields; distinct from update_profile (self-service, no role field) and
    // update_permissions (permissions only) ───
    if (action === "update_admin") {
      const { admin_id, name, email, phone, username, role } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const editRequester = await getAdminAccess(requesterId);
      if (!editRequester || !editRequester.fullAccess) {
        return NextResponse.json({ error: "Only a super admin can edit admins" }, { status: 403 });
      }
      if (!admin_id) return NextResponse.json({ error: "admin_id is required" }, { status: 400 });
      if (!name || !String(name).trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if (!username || !String(username).trim()) return NextResponse.json({ error: "Username is required" }, { status: 400 });

      const editTarget = await getAdminAccess(admin_id);
      const targetRole = editTarget?.role ?? null;
      // Chain of command: only an effective system admin edits a super admin,
      // and the real system admin can only be edited by itself.
      const violation = chainViolation(editRequester, admin_id, editTarget);
      if (violation) return NextResponse.json({ error: violation }, { status: 403 });

      // Role-change rules:
      //  • The system admin's own role is permanent — it can never be changed
      //    (even by itself), so the store always keeps its top-most owner.
      //  • No one can be promoted INTO system_admin — it's a single, pinned
      //    account created only by a direct DB change.
      //  • A super admin can be demoted, but ONLY by the system admin (already
      //    enforced by chainViolation above); a super admin editing another is
      //    blocked before reaching here.
      if (targetRole === SYSTEM_ADMIN_ROLE) {
        if (role !== SYSTEM_ADMIN_ROLE) {
          return NextResponse.json({ error: "The system administrator's role cannot be changed" }, { status: 400 });
        }
      } else if (role === SYSTEM_ADMIN_ROLE) {
        return NextResponse.json({ error: "The system administrator role cannot be assigned" }, { status: 400 });
      }
      const finalRole = targetRole === SYSTEM_ADMIN_ROLE
        ? SYSTEM_ADMIN_ROLE                                  // pinned, unchangeable
        : (role === "superadmin" ? "superadmin" : "admin"); // system admin may set either

      await execute(
        "UPDATE admin_users SET name = ?, email = ?, phone = ?, username = ?, role = ? WHERE id = ?",
        [String(name).trim(), email || null, phone || null, String(username).trim(), finalRole, admin_id]
      );
      await logActivity("Updated admin details", "admin", admin_id, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    // ─── UPDATE PERMISSIONS (full-access only) ───
    if (action === "update_permissions") {
      const { admin_id, permissions } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const permRequester = await getAdminAccess(requesterId);
      if (!permRequester || !permRequester.fullAccess) {
        return NextResponse.json({ error: "Only a super admin can update permissions" }, { status: 403 });
      }
      // A full-access account's permission map is meaningless (role grants
      // everything), so permissions only apply to restricted admins.
      const permTarget = await getAdminAccess(admin_id);
      if (permTarget?.isRealSystemAdmin && admin_id !== requesterId) {
        return NextResponse.json({ error: "The system administrator can only be managed by themselves" }, { status: 403 });
      }
      if (permTarget?.fullAccess) {
        return NextResponse.json({ error: "This account already has full access — permissions don't apply" }, { status: 400 });
      }
      await execute("UPDATE admin_users SET permissions = ? WHERE id = ?", [JSON.stringify(permissions), admin_id]);
      await logActivity("Updated admin permissions", "admin", admin_id, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    // ─── CHANGE PASSWORD (self only) ───
    if (action === "change_password") {
      const { current_password, new_password } = body;
      if (!requesterId || !current_password || !new_password) return NextResponse.json({ error: "All fields are required" }, { status: 400 });
      if (new_password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      if (new_password.length > 128) return NextResponse.json({ error: "Password must be at most 128 characters" }, { status: 400 });

      const rows = await query<RowDataPacket[]>("SELECT password FROM admin_users WHERE id = ?", [requesterId]);
      if (rows.length === 0) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

      const valid = await bcrypt.compare(current_password, rows[0].password as string);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

      const hashed = await bcrypt.hash(new_password, 10);
      await execute("UPDATE admin_users SET password = ? WHERE id = ?", [hashed, requesterId]);
      await logActivity("Changed password", "admin", requesterId, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    // ─── UPDATE PROFILE (self only) — an admin editing their OWN identity
    // fields. admin_id is always the caller (requesterId), never a value from
    // the body, so this can only ever touch the caller's own row. Distinct
    // from update_admin (a superadmin editing SOMEONE ELSE, includes role). ───
    if (action === "update_profile") {
      const { name, email, phone, username } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const admin_id = requesterId;

      const fields: string[] = [];
      const values: (string | null)[] = [];
      if (name) { fields.push("name = ?"); values.push(name); }
      if (email !== undefined) { fields.push("email = ?"); values.push(email || null); }
      if (phone !== undefined) { fields.push("phone = ?"); values.push(phone || null); }
      if (username !== undefined) {
        const uname = String(username).trim().toLowerCase();
        if (!uname) return NextResponse.json({ error: "Username cannot be empty" }, { status: 400 });
        // Username is the login identifier — must stay unique across admins.
        const clash = await query<RowDataPacket[]>(
          "SELECT id FROM admin_users WHERE username = ? AND id <> ? LIMIT 1",
          [uname, admin_id]
        );
        if (clash.length > 0) return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
        fields.push("username = ?"); values.push(uname);
      }
      if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      values.push(admin_id);
      await execute(`UPDATE admin_users SET ${fields.join(", ")} WHERE id = ?`, values);
      // An admin editing their OWN profile (name/username/email/phone) is not
      // an audit-worthy admin action — deliberately not logged. (Editing
      // SOMEONE ELSE goes through update_admin, which is still logged.)
      return NextResponse.json({ success: true });
    }

    // ─── WHOAMI (any authenticated admin) — returns only the caller's own
    // record, for the admin shell to load its own name/role/permissions
    // without needing the full roster (which "list" below still restricts
    // to any logged-in admin, matching prior behavior, just no longer
    // completely unauthenticated). ───
    if (action === "whoami") {
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const rows = await query<RowDataPacket[]>(
        "SELECT id, username, name, email, phone, role, permissions FROM admin_users WHERE id = ? AND is_active = 1 LIMIT 1",
        [requesterId]
      );
      if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const r = rows[0];
      const access = await getAdminAccess(requesterId);
      const raw = parseDbJson(r.permissions);
      // effective_role drives the admin shell's access: a delegate acts as a
      // system admin (canDo short-circuits full access), while keeping their
      // underlying role visible. A full-access account gets a null permission
      // map since the role grants everything.
      return NextResponse.json({
        ...r,
        effective_role: access?.isSystemAdminEffective ? SYSTEM_ADMIN_ROLE : (r.role as string),
        is_delegate: !!access?.isDelegate,
        permissions: access?.fullAccess ? null : normalizePermissions(raw),
      });
    }

    // ─── LIST ADMINS (any authenticated admin — was previously reachable
    // with zero auth check at all, leaking every admin's username/email/
    // phone/permissions to anyone) ───
    if (action === "list") {
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const rows = await query<RowDataPacket[]>("SELECT id, username, name, email, phone, role, permissions, is_active, last_login, created_at, system_admin_delegated, system_admin_until FROM admin_users ORDER BY created_at");
      const now = Date.now();
      return NextResponse.json(rows.map((r) => {
        const raw = parseDbJson(r.permissions);
        const until = r.system_admin_until ? new Date(r.system_admin_until as string) : null;
        // A delegation whose expiry passed is reported as inactive (the lazy
        // cleanup in getAdminAccess clears the row on that admin's next request).
        const delegated = !!r.system_admin_delegated && (!until || until.getTime() > now) && r.role !== SYSTEM_ADMIN_ROLE;
        const fullAccess = r.role === SYSTEM_ADMIN_ROLE || delegated || hasFullAccess(r.role as string);
        return {
          ...r,
          is_active: !!r.is_active,
          is_delegate: delegated,
          delegate_until: delegated ? (r.system_admin_until as string | null) : null,
          permissions: fullAccess ? null : normalizePermissions(raw),
        };
      }));
    }

    // ─── LOGOUT ─── clears all three auth cookies server-side. chinexa-admin-id
    // is httpOnly (see admin-session.ts login branch), so client-side
    // document.cookie writes can no longer clear it themselves.
    if (action === "logout") {
      const res = NextResponse.json({ success: true });
      res.cookies.set("chinexa-admin-id", "", { path: "/", maxAge: 0 });
      res.cookies.set("chinexa-role", "", { path: "/", maxAge: 0 });
      res.cookies.set("chinexa-admin-name", "", { path: "/", maxAge: 0 });
      return res;
    }

    // ─── DELETE ADMIN (full-access only) ───
    if (action === "delete_admin") {
      const { admin_id } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const delRequester = await getAdminAccess(requesterId);
      if (!delRequester || !delRequester.fullAccess) {
        return NextResponse.json({ error: "Only a super admin can remove admins" }, { status: 403 });
      }
      if (requesterId === admin_id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
      const delTarget = await getAdminAccess(admin_id);
      // The real system admin can never be removed by anyone (including a
      // delegate) — the core "delegate can't remove the owner" guarantee.
      if (delTarget?.isRealSystemAdmin) {
        return NextResponse.json({ error: "The system administrator cannot be removed" }, { status: 400 });
      }
      // Chain of command: only an effective system admin may remove a super
      // admin or a delegate; super admins remove regular admins only.
      const violation = chainViolation(delRequester, admin_id, delTarget);
      if (violation) return NextResponse.json({ error: violation }, { status: 403 });
      await execute("DELETE FROM admin_users WHERE id = ?", [admin_id]);
      await logActivity("Deleted admin", "admin", admin_id, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    // ─── TOGGLE ACTIVE (full-access only) ───
    if (action === "toggle_active") {
      const { admin_id, is_active } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const toggleRequester = await getAdminAccess(requesterId);
      if (!toggleRequester || !toggleRequester.fullAccess) {
        return NextResponse.json({ error: "Only a super admin can manage admins" }, { status: 403 });
      }
      // Deactivating is a soft-lockout — same chain of command as delete. The
      // real system admin can never be deactivated by anyone.
      if (!is_active) {
        const toggleTarget = await getAdminAccess(admin_id);
        if (toggleTarget?.isRealSystemAdmin) {
          return NextResponse.json({ error: "The system administrator cannot be deactivated" }, { status: 400 });
        }
        const violation = chainViolation(toggleRequester, admin_id, toggleTarget);
        if (violation) return NextResponse.json({ error: violation }, { status: 403 });
      }
      await execute("UPDATE admin_users SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, admin_id]);
      await logActivity(is_active ? "Activated admin" : "Deactivated admin", "admin", admin_id, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    // ─── DELEGATE SYSTEM ADMIN (real system admin only) ─── grants
    // system-admin-level access to a super admin / admin, permanently or until
    // a date. The delegate can then do everything the system admin can EXCEPT
    // touch the real system admin or manage delegations (enforced by the
    // isRealSystemAdmin / isSystemAdminEffective guards above).
    if (action === "delegate_system_admin") {
      const { admin_id, until } = body; // until: ISO datetime string or null/undefined = permanent
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const delegator = await getAdminAccess(requesterId);
      // Only the REAL system admin may delegate — a delegate cannot re-delegate.
      if (!delegator?.isRealSystemAdmin) {
        return NextResponse.json({ error: "Only the system administrator can delegate their role" }, { status: 403 });
      }
      if (!admin_id || admin_id === requesterId) {
        return NextResponse.json({ error: "Choose another admin to delegate to" }, { status: 400 });
      }
      const target = await getAdminAccess(admin_id);
      if (!target) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
      if (target.isRealSystemAdmin) return NextResponse.json({ error: "That account is already the system administrator" }, { status: 400 });

      let untilValue: string | null = null;
      if (until) {
        const d = new Date(until);
        if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
        if (d.getTime() <= Date.now()) return NextResponse.json({ error: "Expiry must be in the future" }, { status: 400 });
        untilValue = d.toISOString().slice(0, 19).replace("T", " "); // MySQL DATETIME
      }
      await execute(
        "UPDATE admin_users SET system_admin_delegated = 1, system_admin_until = ? WHERE id = ?",
        [untilValue, admin_id]
      );
      await logActivity(
        untilValue ? `Delegated system admin until ${untilValue}` : "Delegated system admin (permanent)",
        "admin", admin_id, undefined, requesterId
      );
      return NextResponse.json({ success: true });
    }

    // ─── REVOKE DELEGATION (real system admin only) ───
    if (action === "revoke_delegation") {
      const { admin_id } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const revoker = await getAdminAccess(requesterId);
      if (!revoker?.isRealSystemAdmin) {
        return NextResponse.json({ error: "Only the system administrator can revoke a delegation" }, { status: 403 });
      }
      await execute(
        "UPDATE admin_users SET system_admin_delegated = 0, system_admin_until = NULL WHERE id = ?",
        [admin_id]
      );
      await logActivity("Revoked system admin delegation", "admin", admin_id, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error";
    if (msg.includes("Duplicate entry")) return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    // Every action in this route other than "login" is gated on the
    // requester's admin_users.role being "superadmin" (checked inline above,
    // predating the shared requirePermission/requireSuperadmin helpers) — an
    // admin-only route, so surface the real error like other admin CRUD
    // routes instead of hiding which constraint/field actually failed.
    console.error("[POST /api/admin-auth]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process admin request" }, { status: 500 });
  }
}
