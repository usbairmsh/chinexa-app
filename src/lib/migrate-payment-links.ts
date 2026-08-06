import { execute } from "@/lib/db";

// ─── Manual payment links ─────────────────────────────────────────────────────
// An admin creates a link for an order (typically a Facebook/phone/counter sale)
// and sends it to the customer, who pays without ever signing in.
//
// Why a separate table instead of more columns on `orders`:
//   • The token is a CAPABILITY. Anyone holding it can view and pay that order,
//     so it needs its own lifecycle — revoke, expire, rotate — independent of
//     the order's own status. A column on `orders` can't be revoked without
//     touching the order row itself.
//   • An order can legitimately need a second link (first one expired, customer
//     lost the message). One row per link keeps that history instead of
//     silently overwriting the previous capability.
//   • It records WHO issued the link and how it was delivered — an audit trail
//     for a flow where an admin is charging a customer directly.
//
// The token is 32 random bytes, base64url — NOT derived from the order id or
// order number, both of which are `Date.now()`-based and trivially enumerable.
// A guessable link would let strangers read a stranger's order and pay it.
let done = false;

export async function ensurePaymentLinkTables() {
  if (done) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS payment_links (
        id VARCHAR(50) PRIMARY KEY,
        token VARCHAR(64) NOT NULL,
        order_id VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        description VARCHAR(255) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        expires_at TIMESTAMP NOT NULL,
        created_by VARCHAR(50) NULL,
        created_by_name VARCHAR(100) NULL,
        sent_via VARCHAR(120) NULL,
        sent_to VARCHAR(255) NULL,
        paid_at TIMESTAMP NULL,
        opened_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_token (token),
        INDEX idx_order (order_id),
        INDEX idx_status_expiry (status, expires_at)
      ) ENGINE=InnoDB`
    );
    done = true;
  } catch (err) {
    console.error("[ensurePaymentLinkTables] migration failed:", err);
    // Leave done=false so a transient failure retries on the next call.
  }
}
