import crypto from "crypto";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { ensurePaymentLinkTables } from "@/lib/migrate-payment-links";

// ─── Manual payment links ─────────────────────────────────────────────────────
// Server-only helpers for creating and resolving admin-issued payment links.
// See migrate-payment-links.ts for why the token is a separate capability.

/** How long a new link stays payable. Admin-facing default, overridable per link. */
export const LINK_WINDOW_HOURS = Number(process.env.PAYMENT_LINK_WINDOW_HOURS) || 24;

/** Allowed expiry choices offered in the admin UI (hours). */
export const LINK_EXPIRY_CHOICES = [24, 72, 168] as const;

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
  order_id: string;
  amount: string | number;
  description: string | null;
  status: LinkStatus;
  expires_at: string;
  created_by: string | null;
  created_by_name: string | null;
  sent_via: string | null;
  sent_to: string | null;
  paid_at: string | null;
  opened_at: string | null;
  created_at: string;
}

export interface ResolvedLink {
  link: PaymentLinkRow;
  order: RowDataPacket;
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

  const orders = await query<RowDataPacket[]>(
    `SELECT id, order_number, customer_id, customer_name, customer_phone, total, status,
            payment_status, payment_method, created_at
       FROM orders WHERE id = ? LIMIT 1`,
    [link.order_id]
  );
  if (orders.length === 0) return null;
  const order = orders[0];

  // Order state wins over link state — an order paid or cancelled through any
  // other channel (COD collected, admin cancellation, EPS reconciliation) must
  // immediately stop being payable through the link.
  let blockedReason: ResolvedLink["blockedReason"] = null;
  if (order.payment_status === "paid") blockedReason = "already_paid";
  else if (["cancelled", "returned", "received", "not_received"].includes(String(order.status))) blockedReason = "order_cancelled";
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
