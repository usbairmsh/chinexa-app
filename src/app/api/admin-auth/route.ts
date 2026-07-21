import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute, parseDbJson } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { normalizePermissions, hasFullAccess, SYSTEM_ADMIN_ROLE } from "@/lib/admin-permissions";
import { createAdminSessionToken, getVerifiedAdminId } from "@/lib/admin-session";
import { ensureSystemAdminRole } from "@/lib/migrate-system-admin";

// Fetch a target admin's role — used by the management actions to protect the
// system administrator and super admins.
async function roleOf(id: string): Promise<string | null> {
  const rows = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [id]);
  return rows.length > 0 ? (rows[0].role as string) : null;
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

      // Update last_login
      await execute("UPDATE admin_users SET last_login = NOW() WHERE id = ?", [admin.id]);
      await logActivity("Admin logged in", "admin", admin.id as string, admin.username as string, admin.id as string);

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

      // Requester must have full access (system admin or super admin).
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requesterId]);
      if (requester.length === 0 || !hasFullAccess(requester[0].role as string)) {
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
      const requesterRole = await roleOf(requesterId);
      if (!requesterRole || !hasFullAccess(requesterRole)) {
        return NextResponse.json({ error: "Only a super admin can edit admins" }, { status: 403 });
      }
      if (!admin_id) return NextResponse.json({ error: "admin_id is required" }, { status: 400 });
      if (!name || !String(name).trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if (!username || !String(username).trim()) return NextResponse.json({ error: "Username is required" }, { status: 400 });

      const targetRole = await roleOf(admin_id);
      // The system administrator can only be edited by the system administrator
      // themselves — no other account, not even a super admin, may touch it.
      if (targetRole === SYSTEM_ADMIN_ROLE && admin_id !== requesterId) {
        return NextResponse.json({ error: "The system administrator can only be edited by themselves" }, { status: 403 });
      }
      // Neither the system admin nor a super admin can have their role changed
      // (a demote-then-delete would be a backdoor around their protection), and
      // no one can be promoted INTO system_admin — it's a single pinned account.
      const targetIsProtected = targetRole === SYSTEM_ADMIN_ROLE || targetRole === "superadmin";
      if (targetIsProtected && role !== targetRole) {
        return NextResponse.json({ error: `A ${targetRole === SYSTEM_ADMIN_ROLE ? "system" : "super"} admin's role cannot be changed` }, { status: 400 });
      }
      const finalRole = targetIsProtected
        ? (targetRole as string)                       // keep the protected role as-is
        : (role === "superadmin" ? "superadmin" : "admin"); // never system_admin for others

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
      const requesterRole = await roleOf(requesterId);
      if (!requesterRole || !hasFullAccess(requesterRole)) {
        return NextResponse.json({ error: "Only a super admin can update permissions" }, { status: 403 });
      }
      // System admin and super admins have full access by role — their
      // permission map is meaningless and must not be writable by others
      // (and the system admin's is off-limits to everyone but themselves).
      const targetRole = await roleOf(admin_id);
      if (targetRole === SYSTEM_ADMIN_ROLE && admin_id !== requesterId) {
        return NextResponse.json({ error: "The system administrator can only be managed by themselves" }, { status: 403 });
      }
      if (targetRole && hasFullAccess(targetRole)) {
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

    // ─── UPDATE PROFILE (self only) ───
    if (action === "update_profile") {
      const { name, email, phone } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const admin_id = requesterId;

      const fields: string[] = [];
      const values: (string | null)[] = [];
      if (name) { fields.push("name = ?"); values.push(name); }
      if (email !== undefined) { fields.push("email = ?"); values.push(email || null); }
      if (phone !== undefined) { fields.push("phone = ?"); values.push(phone || null); }
      if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      values.push(admin_id);
      await execute(`UPDATE admin_users SET ${fields.join(", ")} WHERE id = ?`, values);
      await logActivity("Updated admin profile", "admin", admin_id, undefined, admin_id);
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
      const raw = parseDbJson(r.permissions);
      return NextResponse.json({ ...r, permissions: hasFullAccess(r.role as string) ? null : normalizePermissions(raw) });
    }

    // ─── LIST ADMINS (any authenticated admin — was previously reachable
    // with zero auth check at all, leaking every admin's username/email/
    // phone/permissions to anyone) ───
    if (action === "list") {
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const rows = await query<RowDataPacket[]>("SELECT id, username, name, email, phone, role, permissions, is_active, last_login, created_at FROM admin_users ORDER BY created_at");
      return NextResponse.json(rows.map((r) => {
        const raw = parseDbJson(r.permissions);
        return { ...r, is_active: !!r.is_active, permissions: hasFullAccess(r.role as string) ? null : normalizePermissions(raw) };
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
      const requesterRole = await roleOf(requesterId);
      if (!requesterRole || !hasFullAccess(requesterRole)) {
        return NextResponse.json({ error: "Only a super admin can remove admins" }, { status: 403 });
      }
      if (requesterId === admin_id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
      // The system administrator and every super admin are permanent owners —
      // neither can be removed by anyone (the system admin, not even by itself
      // via this route), so no chain of deletions can leave the store without
      // an owner who can manage admins.
      const targetRole = await roleOf(admin_id);
      if (targetRole === SYSTEM_ADMIN_ROLE) {
        return NextResponse.json({ error: "The system administrator cannot be removed" }, { status: 400 });
      }
      if (targetRole === "superadmin") {
        return NextResponse.json({ error: "A super admin cannot be removed" }, { status: 400 });
      }
      await execute("DELETE FROM admin_users WHERE id = ?", [admin_id]);
      await logActivity("Deleted admin", "admin", admin_id, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    // ─── TOGGLE ACTIVE (full-access only) ───
    if (action === "toggle_active") {
      const { admin_id, is_active } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const requesterRole = await roleOf(requesterId);
      if (!requesterRole || !hasFullAccess(requesterRole)) {
        return NextResponse.json({ error: "Only a super admin can manage admins" }, { status: 403 });
      }
      // Neither the system administrator nor a super admin can be deactivated
      // (a deactivate is just a soft-lockout — same reasoning as delete).
      if (!is_active) {
        const targetRole = await roleOf(admin_id);
        if (targetRole === SYSTEM_ADMIN_ROLE) {
          return NextResponse.json({ error: "The system administrator cannot be deactivated" }, { status: 400 });
        }
        if (targetRole === "superadmin") {
          return NextResponse.json({ error: "A super admin cannot be deactivated" }, { status: 400 });
        }
      }
      await execute("UPDATE admin_users SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, admin_id]);
      await logActivity(is_active ? "Activated admin" : "Deactivated admin", "admin", admin_id, undefined, requesterId);
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
