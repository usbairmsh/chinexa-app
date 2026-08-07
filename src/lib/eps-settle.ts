import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute } from "@/lib/db";
import { ensureEpsTables } from "@/lib/migrate-eps";
import { checkEpsStatus, epsIsPaid, isEpsConfigured } from "@/lib/eps";
import { markLinksPaidForOrder } from "@/lib/payment-links";
import { sendMetaPurchase } from "@/lib/meta-capi-server";

// ─── Shared EPS settlement ────────────────────────────────────────────────────
// Used by BOTH the browser return route and the background reconcile job, so a
// payment settles identically no matter how we find out about it. This is what
// prevents the "customer paid but the order still says unpaid" case when the
// browser never makes it back from the gateway.

/**
 * How long an unpaid EPS order holds its stock. After this the order is
 * auto-cancelled and the stock released (reconciliation always runs first, so a
 * genuinely-paid order is never cancelled).
 */
export const PAYMENT_WINDOW_MINUTES = Number(process.env.EPS_PAYMENT_WINDOW_MINUTES) || 60;

/** UTC ms when an order's payment window closes. */
export function paymentDeadline(createdAt: string | Date): number {
  return new Date(createdAt).getTime() + PAYMENT_WINDOW_MINUTES * 60_000;
}

/** Record a new payment attempt (one per "start payment" click). */
export async function recordAttempt(orderId: string, merchantTxnId: string, amount: number, epsTransactionId?: string) {
  await ensureEpsTables();
  await execute(
    `INSERT INTO eps_payment_attempts (id, order_id, merchant_txn_id, eps_transaction_id, amount, status)
     VALUES (?, ?, ?, ?, ?, 'initiated')
     ON DUPLICATE KEY UPDATE eps_transaction_id = VALUES(eps_transaction_id), updated_at = NOW()`,
    [`epsa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, orderId, merchantTxnId, epsTransactionId || null, amount]
  );
}

export type SettleResult =
  | { settled: true; alreadyPaid: boolean }
  | { settled: false; reason: "not_found" | "no_attempts" | "unpaid" | "amount_mismatch" | "not_configured" | "error" };

/**
 * Verify an order's payment with EPS and settle it if paid.
 *
 * Checks EVERY attempt for the order (not just the latest), because a customer
 * may complete an older attempt after starting a newer one. On a verified
 * Success whose amount matches the order total, the order becomes
 * paid + confirmed. Never trusts anything the browser sent.
 */
export async function settleEpsOrder(orderId: string): Promise<SettleResult> {
  if (!isEpsConfigured()) return { settled: false, reason: "not_configured" };
  await ensureEpsTables();

  try {
    const orders = await query<RowDataPacket[]>(
      "SELECT id, order_number, total, status, payment_status, eps_merchant_txn_id FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );
    if (orders.length === 0) return { settled: false, reason: "not_found" };
    const order = orders[0];

    // Idempotent: settling an already-paid order is a no-op success.
    if (order.payment_status === "paid") return { settled: true, alreadyPaid: true };

    // All attempts, newest first, plus the legacy column value as a fallback for
    // orders created before the attempts table existed.
    const attemptRows = await query<RowDataPacket[]>(
      "SELECT merchant_txn_id FROM eps_payment_attempts WHERE order_id = ? ORDER BY created_at DESC",
      [orderId]
    );
    const txnIds = attemptRows.map((r) => String(r.merchant_txn_id));
    const legacy = String(order.eps_merchant_txn_id || "");
    if (legacy && !txnIds.includes(legacy)) txnIds.push(legacy);
    if (txnIds.length === 0) return { settled: false, reason: "no_attempts" };

    // Compared in integer poisha, not whole taka. Rounding both sides to taka
    // would accept anything within ±0.50 of the total — and payment links let an
    // admin set an arbitrary amount, so sub-taka totals are routine here.
    const orderTotalMinor = Math.round((Number(order.total) || 0) * 100);
    let sawAmountMismatch = false;

    for (const txnId of txnIds) {
      let status;
      try {
        status = await checkEpsStatus(txnId);
      } catch {
        continue; // a single lookup failing must not abort the others
      }
      if (!epsIsPaid(status)) {
        await execute(
          "UPDATE eps_payment_attempts SET status = ? WHERE merchant_txn_id = ?",
          [status.status || "unknown", txnId]
        ).catch(() => {});
        continue;
      }
      // Paid — but the amount must match the order total (anti-tamper).
      if (Math.round((Number(status.totalAmount) || 0) * 100) !== orderTotalMinor) {
        sawAmountMismatch = true;
        await execute(
          "UPDATE eps_payment_attempts SET status = 'amount_mismatch' WHERE merchant_txn_id = ?",
          [txnId]
        ).catch(() => {});
        continue;
      }

      // Settle. The guard on payment_status makes concurrent settles safe (the
      // return route and the cron can race).
      const epsTxn = String(status.raw?.TransactionId || "") || null;
      const res = await execute(
        `UPDATE orders SET payment_status = 'paid', status = 'confirmed',
                eps_merchant_txn_id = ?, eps_transaction_id = COALESCE(?, eps_transaction_id)
         WHERE id = ? AND payment_status <> 'paid'`,
        [txnId, epsTxn, orderId]
      );
      await execute(
        "UPDATE eps_payment_attempts SET status = 'paid', eps_transaction_id = COALESCE(?, eps_transaction_id) WHERE merchant_txn_id = ?",
        [epsTxn, txnId]
      ).catch(() => {});

      // Only the winner of the race writes the timeline entry. The loser's
      // UPDATE matches no row (the payment_status guard above), so affectedRows
      // is 0 — it must be compared explicitly, since a falsy check would read 0
      // as "no result" and let every racer write a duplicate entry.
      const wonRace = res.affectedRows > 0;
      if (wonRace) {
        await execute(
          "INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'confirmed', ?)",
          [orderId, `Payment received via EPS (${status.financialEntity || "online"}). Verified.`]
        ).catch(() => {});
        // Authoritative Meta Purchase — only the racer that actually settled the
        // order fires it (deterministic event id also dedups Meta-side as a
        // backstop). Fires only now that payment genuinely settled, never on
        // redirect, so abandoned EPS payments aren't counted as sales.
        // Best-effort; never blocks settlement.
        await sendMetaPurchase(orderId).catch(() => {});
      }
      // Close out any admin-issued payment link for this order, so the link
      // stops being payable the moment the money lands.
      await markLinksPaidForOrder(orderId);
      return { settled: true, alreadyPaid: false };
    }

    return { settled: false, reason: sawAmountMismatch ? "amount_mismatch" : "unpaid" };
  } catch (err) {
    console.error("[settleEpsOrder]", err);
    return { settled: false, reason: "error" };
  }
}

async function restoreStock(conn: import("mysql2/promise").PoolConnection, orderId: string) {
  const [items] = await conn.execute<RowDataPacket[]>(
    "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?", [orderId]
  );
  for (const item of items) {
    if (!item.product_id) continue;
    if (item.variant_id) {
      await conn.execute("UPDATE product_variants SET stock = stock + ? WHERE id = ?", [item.quantity, item.variant_id]);
    }
    await conn.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [item.quantity, item.product_id]);
  }
}

/**
 * Expire an unpaid EPS order: cancel it, release the held stock, and notify the
 * customer. ONLY call after settleEpsOrder() has confirmed it isn't actually
 * paid — otherwise a real payment could be cancelled out from under a customer.
 */
export async function expireEpsOrder(orderId: string): Promise<boolean> {
  const orders = await query<RowDataPacket[]>(
    "SELECT id, order_number, customer_id, coupon_code, stock_deducted, payment_status, status FROM orders WHERE id = ? LIMIT 1",
    [orderId]
  );
  if (orders.length === 0) return false;
  const order = orders[0];
  if (order.payment_status === "paid" || order.status === "cancelled") return false;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // payment_status = 'failed' + status = 'cancelled' is what the UI reads to
    // show the "Payment Failed" tag on a cancelled order.
    await conn.execute(
      "UPDATE orders SET status = 'cancelled', payment_status = 'failed', updated_at = NOW() WHERE id = ? AND payment_status <> 'paid'",
      [orderId]
    );
    if (Boolean(order.stock_deducted)) {
      await restoreStock(conn, orderId);
      await conn.execute("UPDATE orders SET stock_deducted = FALSE WHERE id = ?", [orderId]);
    }
    if (order.coupon_code) {
      await conn.execute("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?", [order.coupon_code]);
    }
    await conn.execute(
      "INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'cancelled', ?)",
      [orderId, `Payment not completed within ${PAYMENT_WINDOW_MINUTES} minutes — order cancelled and stock released.`]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error("[expireEpsOrder]", err);
    return false;
  } finally {
    conn.release();
  }

  // In-app notification (best-effort, outside the transaction).
  if (order.customer_id) {
    await execute(
      "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, 'order', ?, ?, ?)",
      [
        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        order.customer_id,
        "Payment Failed — Order Cancelled",
        `Your order ${order.order_number} was cancelled because payment wasn't completed in time. You can place the order again.`,
        `/dashboard/orders/${order.order_number}`,
      ]
    ).catch(() => {});
  }
  return true;
}
