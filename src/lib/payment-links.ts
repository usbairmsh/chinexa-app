import crypto from "crypto";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensurePaymentLinkTables } from "@/lib/migrate-payment-links";
import { checkEpsStatus, epsIsPaid } from "@/lib/eps";

// ─── Manual payment links ─────────────────────────────────────────────────────
// Server-only helpers for creating and resolving admin-issued payment links.
// See migrate-payment-links.ts for why the token is a separate capability.

/** How long a new link stays payable. Admin-facing default, overridable per link. */
export const LINK_WINDOW_HOURS = Number(process.env.PAYMENT_LINK_WINDOW_HOURS) || 24;

/** Allowed expiry choices offered in the admin UI (hours). */
export const LINK_EXPIRY_CHOICES = [24, 72, 168] as const;

/**
 * Smallest amount a payment link may charge. Gateway fees make very small
 * collections uneconomic, and it guards against a mistyped amount (a stray
 * decimal turning 500 into 5) reaching a customer.
 *
 * Defined here so the API routes and the admin form share one value and cannot
 * drift apart — a client-side floor that disagrees with the server's would
 * either block valid amounts or promise ones the server then rejects.
 */
export const MIN_LINK_AMOUNT = Number(process.env.PAYMENT_LINK_MIN_AMOUNT) || 50;

/**
 * How far back reconciliation keeps checking standalone links. Comfortably wider
 * than the longest issuable link life (14 days), so a payment made on the last
 * day is still recovered if the customer's browser never returned.
 */
const RECONCILE_LOOKBACK_HOURS = 24 * 45;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com").replace(/\/+$/, "");

/**
 * 32 random bytes, base64url. Deliberately NOT derived from the order id or
 * order number — both are `Date.now()`-based and enumerable, so a token derived
 * from them would let anyone walk the order table.
 */
export function generateLinkToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function paymentLinkUrl(token: string): string {
  return `${SITE_URL}/pay/${token}`;
}

export type LinkStatus = "active" | "paid" | "expired" | "revoked";

export interface PaymentLinkRow extends RowDataPacket {
  id: string;
  token: string;
  /** NULL for a standalone collection; set only when linked to a real order. */
  order_id: string | null;
  amount: string | number;
  description: string | null;
  reference: string | null;
  status: LinkStatus;
  expires_at: string;
  created_by: string | null;
  created_by_name: string | null;
  sent_via: string | null;
  sent_to: string | null;
  eps_merchant_txn_id: string | null;
  eps_transaction_id: string | null;
  paid_amount: string | number | null;
  paid_at: string | null;
  opened_at: string | null;
  created_at: string;
}

export interface ResolvedLink {
  link: PaymentLinkRow;
  /** Null for a standalone link — there is no order behind it. */
  order: RowDataPacket | null;
  /** Why the link can't be paid right now; null when it is payable. */
  blockedReason: null | "expired" | "revoked" | "already_paid" | "order_cancelled";
}

/**
 * Look up a link by token and decide whether it is payable RIGHT NOW.
 *
 * Expiry is computed by MySQL (`expires_at <= NOW()`), not in Node, so a
 * timezone difference between the app container and the database can never make
 * a fresh link look expired — the same reasoning as the EPS payment window.
 *
 * Returns null only when the token doesn't exist, so callers can respond 404
 * without leaking whether a given token was ever valid.
 */
export async function resolvePaymentLink(token: string): Promise<ResolvedLink | null> {
  await ensurePaymentLinkTables();
  if (!token || token.length < 20) return null;

  const rows = await query<PaymentLinkRow[]>(
    `SELECT *, (expires_at <= NOW()) AS is_expired FROM payment_links WHERE token = ? LIMIT 1`,
    [token]
  );
  if (rows.length === 0) return null;
  const link = rows[0];

  // A standalone link has no order behind it; its own row is the whole record.
  let order: RowDataPacket | null = null;
  if (link.order_id) {
    const orders = await query<RowDataPacket[]>(
      `SELECT id, order_number, customer_id, customer_name, customer_phone, total, status,
              payment_status, payment_method, created_at
         FROM orders WHERE id = ? LIMIT 1`,
      [link.order_id]
    );
    if (orders.length === 0) return null;
    order = orders[0];
  }

  // Order state wins over link state when there IS an order — one paid or
  // cancelled through any other channel (COD collected, admin cancellation, EPS
  // reconciliation) must immediately stop being payable through the link.
  let blockedReason: ResolvedLink["blockedReason"] = null;
  if (order && order.payment_status === "paid") blockedReason = "already_paid";
  else if (order && ["cancelled", "returned", "received", "not_received"].includes(String(order.status))) blockedReason = "order_cancelled";
  else if (link.status === "revoked") blockedReason = "revoked";
  else if (link.status === "paid") blockedReason = "already_paid";
  else if (Number((link as RowDataPacket).is_expired) === 1 || link.status === "expired") blockedReason = "expired";

  return { link, order, blockedReason };
}

/** Stamp first-open, for the admin list. Best-effort — never blocks the customer. */
export async function markLinkOpened(linkId: string): Promise<void> {
  try {
    await execute("UPDATE payment_links SET opened_at = NOW() WHERE id = ? AND opened_at IS NULL", [linkId]);
  } catch {
    /* non-critical */
  }
}

/**
 * Settle a STANDALONE link (order_id IS NULL) by asking EPS whether it was paid.
 *
 * The order-backed equivalent is settleEpsOrder in eps-settle.ts. This exists
 * separately because a standalone collection has no order row to write to, no
 * stock to release and no timeline — the link row is the entire record.
 *
 * Like its counterpart it is idempotent and safe to run concurrently: the
 * `status <> 'paid'` guard means only one caller can flip the row, so the return
 * leg and the reconcile job can race without double-recording.
 */
export async function settleStandaloneLink(
  linkId: string
): Promise<{ settled: boolean; reason?: "not_found" | "no_attempts" | "unpaid" | "amount_mismatch" | "error" }> {
  try {
    await ensurePaymentLinkTables();
    const rows = await query<PaymentLinkRow[]>(
      "SELECT * FROM payment_links WHERE id = ? AND order_id IS NULL LIMIT 1",
      [linkId]
    );
    if (rows.length === 0) return { settled: false, reason: "not_found" };
    const link = rows[0];
    if (link.status === "paid") return { settled: true };

    const attempts = await query<RowDataPacket[]>(
      "SELECT merchant_txn_id FROM eps_payment_attempts WHERE order_id = ? ORDER BY created_at DESC",
      [`link:${linkId}`]
    );
    const txnIds = attempts.map((r) => String(r.merchant_txn_id));
    const legacy = String(link.eps_merchant_txn_id || "");
    if (legacy && !txnIds.includes(legacy)) txnIds.push(legacy);
    if (txnIds.length === 0) return { settled: false, reason: "no_attempts" };

    // Compared in integer poisha — the admin sets this amount freely, so
    // sub-taka values are ordinary and a rounded compare would accept
    // underpayment of up to half a taka.
    const expectedMinor = Math.round((Number(link.amount) || 0) * 100);
    let sawMismatch = false;

    for (const txnId of txnIds) {
      let status;
      try {
        status = await checkEpsStatus(txnId);
      } catch {
        continue; // one lookup failing must not abort the others
      }
      if (!epsIsPaid(status)) {
        await execute("UPDATE eps_payment_attempts SET status = ? WHERE merchant_txn_id = ?", [
          status.status || "unknown",
          txnId,
        ]).catch(() => {});
        continue;
      }
      if (Math.round((Number(status.totalAmount) || 0) * 100) !== expectedMinor) {
        sawMismatch = true;
        await execute("UPDATE eps_payment_attempts SET status = 'amount_mismatch' WHERE merchant_txn_id = ?", [
          txnId,
        ]).catch(() => {});
        continue;
      }

      const epsTxn = String(status.raw?.TransactionId || "") || null;
      await execute(
        `UPDATE payment_links
            SET status = 'paid', paid_at = NOW(), paid_amount = ?,
                eps_merchant_txn_id = ?, eps_transaction_id = COALESCE(?, eps_transaction_id)
          WHERE id = ? AND status <> 'paid'`,
        [Number(status.totalAmount) || 0, txnId, epsTxn, linkId]
      );
      await execute(
        "UPDATE eps_payment_attempts SET status = 'paid', eps_transaction_id = COALESCE(?, eps_transaction_id) WHERE merchant_txn_id = ?",
        [epsTxn, txnId]
      ).catch(() => {});
      return { settled: true };
    }

    return { settled: false, reason: sawMismatch ? "amount_mismatch" : "unpaid" };
  } catch (err) {
    console.error(`[settleStandaloneLink] ${linkId} failed:`, err);
    return { settled: false, reason: "error" };
  }
}

/**
 * Reconcile standalone links whose payment may have completed without the
 * browser returning (closed tab, dead connection). Without this, EPS would hold
 * the money while the link still showed unpaid — and remained payable, inviting
 * a second charge. Mirrors what eps-reconcile.ts does for order-backed payments.
 */
export async function reconcileStandaloneLinks(): Promise<{ checked: number; settled: number }> {
  const summary = { checked: 0, settled: 0 };
  try {
    await ensurePaymentLinkTables();
    // Any link with an attempt against it, still unpaid, and not ancient.
    const rows = await query<RowDataPacket[]>(
      `SELECT DISTINCT pl.id FROM payment_links pl
         JOIN eps_payment_attempts a ON a.order_id = CONCAT('link:', pl.id)
        WHERE pl.order_id IS NULL
          AND pl.status <> 'paid'
          AND pl.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        LIMIT 200`,
      [RECONCILE_LOOKBACK_HOURS]
    );
    for (const row of rows) {
      summary.checked++;
      const res = await settleStandaloneLink(String(row.id));
      if (res.settled) summary.settled++;
    }
  } catch (err) {
    console.error("[reconcileStandaloneLinks] failed:", err);
  }
  return summary;
}

/** Mark every active link for an order as paid. Called after EPS settles it. */
export async function markLinksPaidForOrder(orderId: string): Promise<void> {
  try {
    await ensurePaymentLinkTables();
    await execute(
      "UPDATE payment_links SET status = 'paid', paid_at = NOW() WHERE order_id = ? AND status = 'active'",
      [orderId]
    );
  } catch {
    /* non-critical — the order itself is the source of truth for payment */
  }
}

/**
 * Flip past-due active links to 'expired'.
 *
 * This is bookkeeping for the admin list only — `resolvePaymentLink` already
 * refuses a past-due link on its own, so a customer can never pay through one
 * even if this hasn't run yet.
 */
export async function expireStalePaymentLinks(): Promise<number> {
  try {
    await ensurePaymentLinkTables();
    const res = await execute(
      "UPDATE payment_links SET status = 'expired' WHERE status = 'active' AND expires_at <= NOW()"
    );
    return (res as { affectedRows?: number }).affectedRows || 0;
  } catch {
    return 0;
  }
}
