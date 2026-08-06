import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { getRequester, requirePermission } from "@/lib/admin-permissions-server";
import { ensurePaymentLinkTables } from "@/lib/migrate-payment-links";
import {
  generateLinkToken,
  paymentLinkUrl,
  LINK_WINDOW_HOURS,
  MIN_LINK_AMOUNT,
  expireStalePaymentLinks,
} from "@/lib/payment-links";
import { isEpsConfigured } from "@/lib/eps";
import { sendSms, isSmsConfigured } from "@/lib/sms";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// Manual payment links, for orders taken over Facebook/phone/at the counter.
// Gated on `accounting` — the same section that owns Record Sale, since issuing
// a payment link is the same class of action: an admin charging a customer
// directly, outside the storefront checkout.

/**
 * Longest link life we will issue. Capped well inside the reconcile job's
 * link-aware lookback (LINK_LOOKBACK_HOURS in eps-reconcile.ts) — a link that
 * outlived reconciliation could take a payment that is never settled.
 */
const MAX_HOURS = 24 * 14;

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ─── GET /api/payment-links ───────────────────────────────────────────────────
// Lists links for the admin table. `?order_id=` narrows to one order.
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, "accounting", "view");
  if (denied) return denied;

  try {
    await ensurePaymentLinkTables();
    // Keep the list honest: flip anything past due before reading it.
    await expireStalePaymentLinks();

    const orderId = req.nextUrl.searchParams.get("order_id");
    const rows = await query<RowDataPacket[]>(
      // LEFT JOIN, not JOIN: a standalone collection has no order_id, and an
      // inner join would silently hide every one of them from this list.
      `SELECT pl.*, o.order_number, o.customer_name, o.customer_phone,
              o.status AS order_status, o.payment_status
         FROM payment_links pl
         LEFT JOIN orders o ON o.id = pl.order_id
        ${orderId ? "WHERE pl.order_id = ?" : ""}
        ORDER BY pl.created_at DESC
        LIMIT 200`,
      orderId ? [orderId] : []
    );

    return NextResponse.json(
      {
        links: rows.map((r) => ({ ...r, url: paymentLinkUrl(String(r.token)) })),
        // The form reads the minimum from here rather than hardcoding it, so the
        // client-side check can never disagree with what the server enforces.
        defaults: { window_hours: LINK_WINDOW_HOURS, min_amount: MIN_LINK_AMOUNT },
        channels: { sms: isSmsConfigured(), email: isEmailConfigured() },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[GET /api/payment-links]", error);
    return NextResponse.json({ error: "Could not load payment links" }, { status: 500 });
  }
}

// ─── POST /api/payment-links ──────────────────────────────────────────────────
// Issues a link for an EXISTING order. The order itself is created first via
// POST /api/orders (products or custom-amount), so this route never has to
// duplicate order-creation logic, stock handling, or pricing rules.
//
// body: { order_id, expires_in_hours?, description?, send_via?: string[],
//         send_to_phone?, send_to_email? }
export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "accounting", "add");
  if (denied) return denied;

  try {
    if (!isEpsConfigured()) {
      return NextResponse.json(
        { error: "Online payment is not configured, so payment links cannot be issued." },
        { status: 503 }
      );
    }
    await ensurePaymentLinkTables();

    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id || "").trim();
    if (!orderId) return NextResponse.json({ error: "order_id is required" }, { status: 400 });

    const orders = await query<RowDataPacket[]>(
      `SELECT id, order_number, customer_name, customer_phone, total, status, payment_status
         FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    if (orders.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = orders[0];

    // Don't issue a link that could never be paid.
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
    }
    if (["cancelled", "returned", "received", "not_received"].includes(String(order.status))) {
      return NextResponse.json({ error: "This order can no longer be paid for." }, { status: 409 });
    }
    const amount = Number(order.total) || 0;
    if (amount <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero." }, { status: 400 });
    }
    if (amount < MIN_LINK_AMOUNT) {
      return NextResponse.json(
        { error: `This order's total is below the BDT ${MIN_LINK_AMOUNT} minimum for online payment.` },
        { status: 400 }
      );
    }

    const hours = Math.min(MAX_HOURS, Math.max(1, Number(body.expires_in_hours) || LINK_WINDOW_HOURS));

    // Revoke any still-active link for this order. Two live links on one order
    // means two payable capabilities for the same money — the customer could be
    // charged twice if both are opened. Re-issuing always supersedes.
    await execute(
      "UPDATE payment_links SET status = 'revoked' WHERE order_id = ? AND status = 'active'",
      [orderId]
    );

    const requester = await getRequester(req);
    const token = generateLinkToken();
    const id = `plink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const requestedChannels: string[] = Array.isArray(body.send_via)
      ? body.send_via.map((c: unknown) => String(c))
      : [];
    const phone = String(body.send_to_phone || "").trim();
    const email = String(body.send_to_email || "").trim();

    // Validate delivery inputs BEFORE creating the link, so a typo doesn't leave
    // an orphaned link that was never actually sent to anyone.
    if (requestedChannels.includes("sms") && !phone) {
      return NextResponse.json({ error: "A phone number is required to send by SMS." }, { status: 400 });
    }
    if (requestedChannels.includes("email") && !isEmail(email)) {
      return NextResponse.json({ error: "A valid email address is required to send by email." }, { status: 400 });
    }

    await execute(
      `INSERT INTO payment_links
         (id, token, order_id, amount, description, status, expires_at, created_by, created_by_name, sent_via, sent_to)
       VALUES (?, ?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, ?, ?)`,
      [
        id,
        token,
        orderId,
        amount,
        String(body.description || "").slice(0, 255) || null,
        hours,
        requester?.id || null,
        String(body.created_by_name || "").slice(0, 100) || null,
        requestedChannels.length ? requestedChannels.join(",") : null,
        [phone, email].filter(Boolean).join(", ").slice(0, 255) || null,
      ]
    );

    const url = paymentLinkUrl(token);
    const orderNo = String(order.order_number);
    const amountText = `BDT ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const delivery: { channel: string; ok: boolean; error?: string }[] = [];

    // Delivery is best-effort and reported per channel. A failed SMS must not
    // fail the request — the link exists and the admin can still copy it.
    if (requestedChannels.includes("sms")) {
      const msg = `ChineXa: Payment for order ${orderNo} — ${amountText}. Pay securely here: ${url} (link expires in ${hours}h)`;
      const r = await sendSms(normalizePhone(phone), msg).catch((e) => ({ success: false, error: String(e) }));
      delivery.push({ channel: "sms", ok: !!r.success, error: r.success ? undefined : r.error });
    }

    if (requestedChannels.includes("email")) {
      const html = `
        <p>Hello ${order.customer_name || "there"},</p>
        <p>Here is your secure payment link for order <strong>${orderNo}</strong>.</p>
        <p style="font-size:20px;font-weight:700;margin:16px 0;">${amountText}</p>
        <p style="margin:24px 0;">
          <a href="${url}" style="background:#2f6f4e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Pay Now</a>
        </p>
        <p style="color:#666;font-size:13px;">This link expires in ${hours} hours. If the button doesn't work, copy and paste this into your browser:<br>${url}</p>
      `;
      const r = await sendEmail({
        to: email,
        subject: `Payment link for your ChineXa order ${orderNo}`,
        html,
        text: `Payment for order ${orderNo} — ${amountText}. Pay here: ${url} (expires in ${hours}h)`,
      }).catch((e) => ({ success: false, error: String(e) }));
      delivery.push({ channel: "email", ok: !!r.success, error: r.success ? undefined : r.error });
    }

    return NextResponse.json({ id, token, url, amount, expires_in_hours: hours, delivery });
  } catch (error) {
    console.error("[POST /api/payment-links]", error);
    return NextResponse.json({ error: "Could not create the payment link" }, { status: 500 });
  }
}
