import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// admin_users.role is an ENUM('superadmin','admin'); the top-most owner role
// 'system_admin' has to be added to the ENUM before any row can hold it.
// Idempotent + self-healing like the other migrate-*.ts helpers, so a fresh
// deploy doesn't need setup-db.sql re-run.
let done = false;

export async function ensureSystemAdminRole() {
  if (done) return;
  try {
    const cols = await query<RowDataPacket[]>(
      `SELECT COLUMN_TYPE AS t FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'admin_users' AND column_name = 'role'`
    );
    const colType = (cols[0]?.t as string) || "";
    if (!colType.includes("system_admin")) {
      await execute(
        "ALTER TABLE admin_users MODIFY COLUMN role ENUM('system_admin','superadmin','admin') DEFAULT 'admin'"
      );
    }
    done = true;
  } catch (err) {
    // Leave done=false so a transient failure retries on the next request.
    console.error("[ensureSystemAdminRole] migration failed:", err);
  }
}
