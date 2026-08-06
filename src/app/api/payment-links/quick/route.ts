import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { getRequester, requirePermission } from "@/lib/admin-permissions-server";
import { ensurePaymentLinkTables } from "@/lib/migrate-payment-links";
import {
  generateLinkToken,
  paymentLinkUrl,
  LINK_WINDOW_HOURS,
  MIN_LINK_AMOUNT,
} from "@/lib/payment-links";
import { isEpsConfigured } from "@/lib/eps";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// ─── POST /api/payment-links/quick ────────────────────────────────────────────
// A STANDALONE payment collection: the admin enters an amount, gets a link, and
// sends it. Deliberately NOT an order.
//
// It creates no order, no order number, and no customer record. It is money
// collected outside the store's sales pipeline (a service charge, a courier fee,
// a partial settlement), so it must not appear in order lists, must not deduct
// stock, and must not move any revenue, order-count or customer figure in
// accounting. Nothing here writes to `orders`, `order_items` or `customers`.
//
// Settlement therefore targets the link row itself — see settleStandaloneLink in
// lib/payment-links.ts, the counterpart to settleEpsOrder for order-backed pays.
//
// The separate POST /api/payment-links route is the other shape: a link issued
// against a REAL existing order, which does count as a sale.

// Capped inside the reconcile lookback (see payment-links.ts): a link outliving
// reconciliation could take a payment that is never settled.
const MAX_HOURS = 24 * 14;
const MAX_AMOUNT = 10_000_000;

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

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
    const description = String(body.description || "").trim();
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Enter an amount greater than zero" }, { status: 400 });
    }
    if (amount < MIN_LINK_AMOUNT) {
      return NextResponse.json(
        { error: `The minimum payment amount is BDT ${MIN_LINK_AMOUNT}.` },
        { status: 400 }
      );
    }
    if (amount > MAX_AMOUNT) {
      return NextResponse.json({ error: "That amount looks too large. Please check it." }, { status: 400 });
    }
    // Round to 2dp so the DECIMAL(12,2) column and the amount EPS verifies on
    // settlement agree exactly — a mismatch there is treated as tampering.
    const total = Math.round(amount * 100) / 100;

    const channels: string[] = Array.isArray(body.send_via) ? body.send_via.map((c: unknown) => String(c)) : [];
    const smsTo = String(body.send_to_phone || "").trim();
    const emailTo = String(body.send_to_email || "").trim();

    // Validate delivery inputs BEFORE creating anything, so a typo can't leave
    // an orphaned link that was never delivered.
    if (channels.includes("sms") && !smsTo) {
      return NextResponse.json({ error: "A phone number is required to send by SMS." }, { status: 400 });
    }
    if (channels.includes("email") && !isEmail(emailTo)) {
      return NextResponse.json({ error: "A valid email address is required to send by email." }, { status: 400 });
    }

    const hours = Math.min(MAX_HOURS, Math.max(1, Number(body.expires_in_hours) || LINK_WINDOW_HOURS));

    const requester = await getRequester(req);
    const token = generateLinkToken();
    const linkId = `plink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // A short human-readable handle for receipts and support conversations.
    // Deliberately prefixed PAY- so it can never be mistaken for an order number.
    const reference = `PAY-${String(Date.now()).slice(-6)}`;

    await execute(
      `INSERT INTO payment_links
         (id, token, order_id, amount, description, reference, status, expires_at,
          created_by, created_by_name, sent_via, sent_to)
       VALUES (?, ?, NULL, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, ?, ?)`,
      [
        linkId,
        token,
        total,
        description.slice(0, 255) || null,
        reference,
        hours,
        requester?.id || null,
        String(body.created_by_name || "").slice(0, 100) || null,
        channels.length ? channels.join(",") : null,
        [smsTo, emailTo].filter(Boolean).join(", ").slice(0, 255) || null,
      ]
    );

    const url = paymentLinkUrl(token);
    const amountText = `BDT ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const delivery: { channel: string; ok: boolean; error?: string }[] = [];

    // Delivery is best-effort and reported per channel — a failed SMS must not
    // fail the request, because the link exists and can still be copied.
    if (channels.includes("sms")) {
      const r = await sendSms(
        normalizePhone(smsTo),
        `ChineXa: Payment request ${reference} — ${amountText}. Pay securely here: ${url} (expires in ${hours}h)`
      ).catch((e) => ({ success: false, error: String(e) }));
      delivery.push({ channel: "sms", ok: !!r.success, error: r.success ? undefined : r.error });
    }

    if (channels.includes("email")) {
      const r = await sendEmail({
        to: emailTo,
        subject: `Payment request from ChineXa — ${amountText}`,
        html: `
          <p>Hello,</p>
          <p>Here is your secure payment link${description ? ` for <strong>${description}</strong>` : ""}.</p>
          <p style="font-size:20px;font-weight:700;margin:16px 0;">${amountText}</p>
          <p style="margin:24px 0;">
            <a href="${url}" style="background:#7A4FA0;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Pay Now</a>
          </p>
          <p style="color:#666;font-size:13px;">This link expires in ${hours} hours. If the button doesn't work, copy and paste this into your browser:<br>${url}</p>
          <p style="color:#999;font-size:12px;">Reference: ${reference}</p>
        `,
        text: `Payment request ${reference} — ${amountText}. Pay here: ${url} (expires in ${hours}h)`,
      }).catch((e) => ({ success: false, error: String(e) }));
      delivery.push({ channel: "email", ok: !!r.success, error: r.success ? undefined : r.error });
    }

    return NextResponse.json({
      id: linkId,
      token,
      url,
      reference,
      amount: total,
      expires_in_hours: hours,
      delivery,
    });
  } catch (error) {
    console.error("[POST /api/payment-links/quick]", error);
    return NextResponse.json({ error: "Could not create the payment link" }, { status: 500 });
  }
}
