import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ─── LOGIN ───
    if (action === "login") {
      const { username, password } = body;
      if (!username || !password) return NextResponse.json({ error: "Username and password are required" }, { status: 400 });

      const rows = await query<RowDataPacket[]>(
        "SELECT * FROM admin_users WHERE username = ? AND is_active = 1 LIMIT 1", [username]
      );
      if (rows.length === 0) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

      const admin = rows[0];
      const valid = await bcrypt.compare(password, admin.password as string);
      if (!valid) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

      // Update last_login
      await execute("UPDATE admin_users SET last_login = NOW() WHERE id = ?", [admin.id]);

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
      const { requester_id, username, password, name, email, phone, role } = body;
      if (!requester_id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // Check requester is superadmin
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requester_id]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can add new admins" }, { status: 403 });
      }

      if (!username || !password || !name) return NextResponse.json({ error: "Username, password, and name are required" }, { status: 400 });

      const hashed = await bcrypt.hash(password, 10);
      const id = `adm-${Date.now()}`;
      const perms = body.permissions ? JSON.stringify(body.permissions) : null;
      await execute(
        "INSERT INTO admin_users (id, username, password, name, email, phone, role, permissions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, username, hashed, name, email || null, phone || null, role === "superadmin" ? "superadmin" : "admin", perms]
      );

      return NextResponse.json({ success: true, id }, { status: 201 });
    }

    // ─── UPDATE PERMISSIONS (superadmin only) ───
    if (action === "update_permissions") {
      const { requester_id, admin_id, permissions } = body;
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requester_id]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can update permissions" }, { status: 403 });
      }
      await execute("UPDATE admin_users SET permissions = ? WHERE id = ?", [JSON.stringify(permissions), admin_id]);
      return NextResponse.json({ success: true });
    }

    // ─── CHANGE PASSWORD (self only) ───
    if (action === "change_password") {
      const { admin_id, current_password, new_password } = body;
      if (!admin_id || !current_password || !new_password) return NextResponse.json({ error: "All fields are required" }, { status: 400 });
      if (new_password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

      const rows = await query<RowDataPacket[]>("SELECT password FROM admin_users WHERE id = ?", [admin_id]);
      if (rows.length === 0) return NextResponse.json({ error: "Admin not found" }, { status: 404 });

      const valid = await bcrypt.compare(current_password, rows[0].password as string);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

      const hashed = await bcrypt.hash(new_password, 10);
      await execute("UPDATE admin_users SET password = ? WHERE id = ?", [hashed, admin_id]);
      return NextResponse.json({ success: true });
    }

    // ─── UPDATE PROFILE (self only) ───
    if (action === "update_profile") {
      const { admin_id, name, email, phone } = body;
      if (!admin_id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const fields: string[] = [];
      const values: (string | null)[] = [];
      if (name) { fields.push("name = ?"); values.push(name); }
      if (email !== undefined) { fields.push("email = ?"); values.push(email || null); }
      if (phone !== undefined) { fields.push("phone = ?"); values.push(phone || null); }
      if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      values.push(admin_id);
      await execute(`UPDATE admin_users SET ${fields.join(", ")} WHERE id = ?`, values);
      return NextResponse.json({ success: true });
    }

    // ─── LIST ADMINS (superadmin only) ───
    if (action === "list") {
      const rows = await query<RowDataPacket[]>("SELECT id, username, name, email, phone, role, permissions, is_active, last_login, created_at FROM admin_users ORDER BY created_at");
      return NextResponse.json(rows.map((r) => {
        let perms = null;
        try { perms = r.permissions ? JSON.parse(r.permissions as string) : null; } catch { perms = null; }
        return { ...r, is_active: !!r.is_active, permissions: perms };
      }));
    }

    // ─── DELETE ADMIN (superadmin only) ───
    if (action === "delete_admin") {
      const { requester_id, admin_id } = body;
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requester_id]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can remove admins" }, { status: 403 });
      }
      if (requester_id === admin_id) return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
      await execute("DELETE FROM admin_users WHERE id = ?", [admin_id]);
      return NextResponse.json({ success: true });
    }

    // ─── TOGGLE ACTIVE (superadmin only) ───
    if (action === "toggle_active") {
      const { requester_id, admin_id, is_active } = body;
      const requester = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [requester_id]);
      if (requester.length === 0 || requester[0].role !== "superadmin") {
        return NextResponse.json({ error: "Only super admin can manage admins" }, { status: 403 });
      }
      await execute("UPDATE admin_users SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, admin_id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error";
    if (msg.includes("Duplicate entry")) return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
