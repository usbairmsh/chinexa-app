import { execute } from "./db";

export async function logActivity(action: string, entityType?: string, entityId?: string, details?: string) {
  try {
    await execute(
      "INSERT INTO activity_log (user_id, user_name, action, entity_type, entity_id, details) VALUES ('admin-1', 'Admin', ?, ?, ?, ?)",
      [action, entityType || null, entityId || null, details || null]
    );
  } catch {
    // Silently fail — don't break the main operation
  }
}
