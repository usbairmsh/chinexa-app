import { execute } from "@/lib/db";

// ─── Auto-migration for the account-scoped (server-side) cart ───
// The storefront cart is otherwise localStorage-only. This table lets a
// logged-in customer's cart follow them across devices / survive logout —
// one row per customer holding the whole cart as JSON. Idempotent; latches
// "done" only after the CREATE succeeds so a transient failure retries later.
// Mirrors the ensure* pattern used across the other migrate-*.ts helpers.
let done = false;

export async function ensureCartTable() {
  if (done) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS customer_carts (
        customer_id VARCHAR(50) PRIMARY KEY,
        items JSON NOT NULL,
        coupon_code VARCHAR(60) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`
    );
    done = true;
  } catch {
    // Leave done=false so a later call retries (e.g. transient DB unavailability).
  }
}
