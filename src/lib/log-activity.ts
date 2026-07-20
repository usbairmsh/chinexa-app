import { execute, query } from "./db";
import { type RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { verifyAdminSessionToken } from "./admin-session";

async function resolveAdmin(adminId?: string): Promise<{ id: string; name: string }> {
  // Try passed adminId first, then the signed session cookie. The cookie's
  // value is now a signed token (see admin-session.ts), not the raw id, so
  // it must be verified/decoded here too — a raw read would just be the
  // opaque token string, which no longer matches any admin_users.id.
  let id = adminId;
  if (!id) {
    try {
      const cookieStore = await cookies();
      id = verifyAdminSessionToken(cookieStore.get("chinexa-admin-id")?.value) || undefined;
    } catch {}
  }

  if (!id) return { id: "system", name: "System" };

  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT name, username FROM admin_users WHERE id = ? LIMIT 1",
      [id]
    );
    if (rows.length > 0) {
      return { id, name: (rows[0].name as string) || (rows[0].username as string) || "Admin" };
    }
  } catch {}

  return { id, name: "Admin" };
}

export async function logActivity(action: string, entityType?: string, entityId?: string, details?: string, adminId?: string) {
  try {
    const admin = await resolveAdmin(adminId);
    await execute(
      "INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)",
      [admin.id, admin.name, action, entityType || null, entityId || null, details || null]
    );
  } catch {
    // Silently fail — don't break the main operation
  }
}
