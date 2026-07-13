import { execute } from "@/lib/db";

// The `roles` table is declared in scripts/setup-db.sql but that script
// isn't re-run against already-provisioned databases, so ensure it exists
// at runtime the same way ensurePromotionColumns() does for its own tables.
let done = false;

export async function ensureRolesTable() {
  if (done) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    done = true;
  } catch {
    // Leave `done` false — retried on the next call instead of permanently
    // skipped, in case this failed due to a transient DB connection issue.
  }
}
