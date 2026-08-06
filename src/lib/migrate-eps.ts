import { execute } from "@/lib/db";

// ─── EPS payment attempts ─────────────────────────────────────────────────────
// One row per "start a payment" attempt on an order. A customer who abandons the
// gateway and later retries produces several attempts, each with its OWN unique
// merchantTransactionId (EPS requires uniqueness per transaction).
//
// Why a table and not just orders.eps_merchant_txn_id: that column only holds
// the LATEST attempt. If a customer completes an EARLIER attempt late (e.g. they
// left the first tab open and paid there), reconciliation must still be able to
// find and settle it — otherwise the money is taken and the order stays unpaid.
// Reconciliation therefore checks every attempt for an order.
let done = false;

export async function ensureEpsTables() {
  if (done) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS eps_payment_attempts (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL,
        merchant_txn_id VARCHAR(64) NOT NULL,
        eps_transaction_id VARCHAR(64) NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'initiated',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_merchant_txn (merchant_txn_id),
        INDEX idx_order (order_id, created_at)
      ) ENGINE=InnoDB`
    );
    done = true;
  } catch (err) {
    console.error("[ensureEpsTables] migration failed:", err);
    // Leave done=false so a transient failure retries on the next call.
  }
}
