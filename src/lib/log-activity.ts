import { execute, query } from "./db";
import { type RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";

async function resolveAdmin(adminId?: string): Promise<{ id: string; name: string }> {
  // Try passed adminId first, then cookie
  let id = adminId;
  if (!id) {
    try {
      const cookieStore = await cookies();
      id = cookieStore.get("chinexa-admin-id")?.value;
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
