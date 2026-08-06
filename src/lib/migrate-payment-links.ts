import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// ─── Manual payment links ─────────────────────────────────────────────────────
// An admin enters an amount and gets a link to send to anyone, who pays without
// signing in. These are STANDALONE collections — deliberately not orders:
//
//   • order_id is NULL for a standalone link. It never creates an order, never
//     touches a customer record, never appears in order lists, and is excluded
//     from every revenue/order figure in accounting. It is money collected
//     outside the store's sales pipeline and is reported on its own.
//   • order_id is set only for the separate flow that issues a link against a
//     real existing order (Record Sale → payment link), which SHOULD count as a
//     sale. Both shapes share this table because the token, expiry, delivery and
//     revoke semantics are identical; only the settlement target differs.
//
// The token is a CAPABILITY, which is why it lives here rather than as a column
// on some other row: it needs its own lifecycle (revoke, expire, re-issue), and
// one target may need a second link when the first lapses.
//
// It is 32 random bytes, base64url — never derived from any id, since the ids in
// this system are `Date.now()`-based and trivially enumerable.
let done = false;

export async function ensurePaymentLinkTables() {
  if (done) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS payment_links (
        id VARCHAR(50) PRIMARY KEY,
        token VARCHAR(64) NOT NULL,
        order_id VARCHAR(50) NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        description VARCHAR(255) NULL,
        reference VARCHAR(40) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        expires_at TIMESTAMP NOT NULL,
        created_by VARCHAR(50) NULL,
        created_by_name VARCHAR(100) NULL,
        sent_via VARCHAR(120) NULL,
        sent_to VARCHAR(255) NULL,
        eps_merchant_txn_id VARCHAR(64) NULL,
        eps_transaction_id VARCHAR(64) NULL,
        paid_amount DECIMAL(12,2) NULL,
        paid_at TIMESTAMP NULL,
        opened_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_token (token),
        INDEX idx_order (order_id),
        INDEX idx_status_expiry (status, expires_at)
      ) ENGINE=InnoDB`
    );

    // Self-healing for deployments created before standalone links existed:
    // order_id was NOT NULL, and the payment/reference columns didn't exist.
    const cols = await query<RowDataPacket[]>(
      `SELECT COLUMN_NAME AS c, IS_NULLABLE AS n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_links'`
    );
    const byName = new Map(cols.map((r) => [String(r.c), String(r.n)]));
    if (byName.get("order_id") === "NO") {
      await execute("ALTER TABLE payment_links MODIFY COLUMN order_id VARCHAR(50) NULL");
    }
    const add: Record<string, string> = {
      reference: "VARCHAR(40) NULL",
      eps_merchant_txn_id: "VARCHAR(64) NULL",
      eps_transaction_id: "VARCHAR(64) NULL",
      paid_amount: "DECIMAL(12,2) NULL",
    };
    for (const [col, ddl] of Object.entries(add)) {
      if (!byName.has(col)) await execute(`ALTER TABLE payment_links ADD COLUMN ${col} ${ddl}`);
    }

    done = true;
  } catch (err) {
    console.error("[ensurePaymentLinkTables] migration failed:", err);
    // Leave done=false so a transient failure retries on the next call, and
    // rethrow: callers must not proceed on a schema that isn't ready. Creating a
    // standalone link against a still-NOT-NULL order_id would fail anyway, but
    // with an opaque driver error instead of a clear one.
    throw err;
  }
}
