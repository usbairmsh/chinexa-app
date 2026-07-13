import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { normalizePermissions } from "@/lib/admin-permissions";

// Admin credentials guard the whole store — cap login attempts per
// username+IP so a password can't just be ground through with unlimited
// guesses.
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    // The acting admin's identity must come from the cookie the browser sends
    // automatically, never from body.requester_id — that field is fully
    // client-controlled, so trusting it let anyone who merely knew (or
    // guessed) any superadmin's id perform every privileged action below by
    // just typing that id into the request body themselves.
    const requesterId = req.cookies.get("chinexa-admin-id")?.value || null;

    // ─── LOGIN ───
    if (action === "login") {
      const { username, password } = body;
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

      return NextResponse.json({
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
    }

    // ─── ADD ADMIN (superadmin only) ───
    if (action === "add_admin") {
      const { username, password, name, email, phone, role } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // Check requester is superadmin
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requesterId]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can add new admins" }, { status: 403 });
      }

      if (!username || !password || !name) return NextResponse.json({ error: "Username, password, and name are required" }, { status: 400 });
      if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      if (password.length > 128) return NextResponse.json({ error: "Password must be at most 128 characters" }, { status: 400 });

      const hashed = await bcrypt.hash(password, 10);
      const id = `adm-${Date.now()}`;
      const perms = body.permissions ? JSON.stringify(body.permissions) : null;
      await execute(
        "INSERT INTO admin_users (id, username, password, name, email, phone, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, username, hashed, name, email || null, phone || null, role === "superadmin" ? "superadmin" : "admin", perms]
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
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requesterId]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can edit admins" }, { status: 403 });
      }
      if (!admin_id) return NextResponse.json({ error: "admin_id is required" }, { status: 400 });
      if (!name || !String(name).trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if (!username || !String(username).trim()) return NextResponse.json({ error: "Username is required" }, { status: 400 });

      // A superadmin editing their own row can't demote themselves — avoids
      // accidentally locking every superadmin out of admin management.
      if (admin_id === requesterId && role !== "superadmin") {
        return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
      }

      await execute(
        "UPDATE admin_users SET name = ?, email = ?, phone = ?, username = ?, role = ? WHERE id = ?",
        [String(name).trim(), email || null, phone || null, String(username).trim(), role === "superadmin" ? "superadmin" : "admin", admin_id]
      );
      await logActivity("Updated admin details", "admin", admin_id, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    // ─── UPDATE PERMISSIONS (superadmin only) ───
    if (action === "update_permissions") {
      const { admin_id, permissions } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requesterId]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can update permissions" }, { status: 403 });
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

    // ─── LIST ADMINS (superadmin only) ───
    if (action === "list") {
      const rows = await query<RowDataPacket[]>("SELECT id, username, name, email, phone, role, permissions, is_active, last_login, created_at FROM admin_users ORDER BY created_at");
      return NextResponse.json(rows.map((r) => {
        let raw: unknown = null;
        try { raw = r.permissions ? JSON.parse(r.permissions as string) : null; } catch { raw = null; }
        return { ...r, is_active: !!r.is_active, permissions: r.role === "superadmin" ? null : normalizePermissions(raw) };
      }));
    }

    // ─── DELETE ADMIN (superadmin only) ───
    if (action === "delete_admin") {
      const { admin_id } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requesterId]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can remove admins" }, { status: 403 });
      }
      if (requesterId === admin_id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
      await execute("DELETE FROM admin_users WHERE id = ?", [admin_id]);
      await logActivity("Deleted admin", "admin", admin_id, undefined, requesterId);
      return NextResponse.json({ success: true });
    }

    // ─── TOGGLE ACTIVE (superadmin only) ───
    if (action === "toggle_active") {
      const { admin_id, is_active } = body;
      if (!requesterId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requesterId]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can manage admins" }, { status: 403 });
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
