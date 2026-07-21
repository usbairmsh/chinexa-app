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

    // Delegation: the real system admin can grant system-admin-level access to
    // another admin, permanently (system_admin_until NULL) or until a date.
    // system_admin_delegated marks it as a DELEGATED grant (never the real
    // owner), so a delegate can be blocked from touching the real system admin.
    const delegCols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'admin_users'
       AND column_name IN ('system_admin_delegated','system_admin_until')`
    );
    const hasDeleg = new Set(delegCols.map((r) => r.c as string));
    if (!hasDeleg.has("system_admin_delegated")) {
      await execute("ALTER TABLE admin_users ADD COLUMN system_admin_delegated TINYINT(1) NOT NULL DEFAULT 0");
    }
    if (!hasDeleg.has("system_admin_until")) {
      await execute("ALTER TABLE admin_users ADD COLUMN system_admin_until DATETIME NULL DEFAULT NULL");
    }
    done = true;
  } catch (err) {
    // Leave done=false so a transient failure retries on the next request.
    console.error("[ensureSystemAdminRole] migration failed:", err);
  }
}
