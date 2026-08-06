import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { getRequester, requirePermission } from "@/lib/admin-permissions-server";
import { ensurePaymentLinkTables } from "@/lib/migrate-payment-links";
import { generateLinkToken, paymentLinkUrl, LINK_WINDOW_HOURS } from "@/lib/payment-links";
import { isEpsConfigured } from "@/lib/eps";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// ─── POST /api/payment-links/quick ────────────────────────────────────────────
// The one-step flow behind the admin "Create Payment Link" form: the admin types
// a customer name, phone and AMOUNT, and gets back a copyable link.
//
// It creates a lightweight order to hang the payment on, because every downstream
// piece — EPS initiate, settlement, reconciliation, accounting, the customer's
// order history — is already built around an order row. Inventing a parallel
// "linked payment with no order" concept would mean duplicating all of it.
//
// The order carries a single synthetic line item with NO product_id, which is
// exactly how POST /api/orders already distinguishes "don't touch stock" (the
// deduction loop is guarded by `if (item.product_id)`). So a custom-amount link
// never moves inventory, while a product-based link (created via Record Sale +
// POST /api/payment-links) still does.

// Capped inside the reconcile job's link-aware lookback (see eps-reconcile.ts):
// a link outliving reconciliation could take a payment that is never settled.
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
    const customerName = String(body.customer_name || "").trim();
    const customerPhone = String(body.customer_phone || "").trim();
    const description = String(body.description || "").trim();
    const amount = Number(body.amount);

    if (!customerName) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (!customerPhone) return NextResponse.json({ error: "Customer phone is required" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Enter an amount greater than zero" }, { status: 400 });
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
    // an orphaned order + link that was never delivered.
    if (channels.includes("sms") && !smsTo) {
      return NextResponse.json({ error: "A phone number is required to send by SMS." }, { status: 400 });
    }
    if (channels.includes("email") && !isEmail(emailTo)) {
      return NextResponse.json({ error: "A valid email address is required to send by email." }, { status: 400 });
    }

    const hours = Math.min(MAX_HOURS, Math.max(1, Number(body.expires_in_hours) || LINK_WINDOW_HOURS));

    // Attach to an existing customer by phone when we already know them, so the
    // payment shows up in their order history instead of creating a duplicate.
    const normalized = normalizePhone(customerPhone);
    let customerId: string | null = null;
    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM customers WHERE phone = ? OR phone = ? LIMIT 1",
      [customerPhone, normalized]
    );
    if (existing.length > 0) customerId = String(existing[0].id);

    const orderId = `ord-${Date.now()}`;
    const orderNumber = `ORD-${String(Date.now()).slice(-6)}`;
    const label = description || "Custom payment";

    // payment_method EPS + payment_status pending is what makes this order
    // visible to the reconcile job and payable through the gateway.
    await execute(
      `INSERT INTO orders
         (id, order_number, customer_id, customer_name, customer_phone, subtotal, shipping_cost,
          discount, tax, total, status, payment_method, payment_status, notes, source, stock_deducted)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'pending', 'EPS', 'pending', ?, 'manual', 0)`,
      [orderId, orderNumber, customerId, customerName, normalized, total, total, `Payment link: ${label}`]
    );

    // Synthetic line with no product_id — see the note at the top of this file.
    // order_items.id is a non-auto PRIMARY KEY, so it must be supplied.
    await execute(
      `INSERT INTO order_items (id, order_id, product_id, product_name, variant, quantity, unit_price, total_price)
       VALUES (?, ?, NULL, ?, NULL, 1, ?, ?)`,
      [`oi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, orderId, label.slice(0, 200), total, total]
    ).catch(async (e) => {
      // Roll the order back rather than leaving a total with nothing behind it.
      await execute("DELETE FROM orders WHERE id = ?", [orderId]).catch(() => {});
      throw e;
    });

    const requester = await getRequester(req);
    const token = generateLinkToken();
    const linkId = `plink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await execute(
      `INSERT INTO payment_links
         (id, token, order_id, amount, description, status, expires_at, created_by, created_by_name, sent_via, sent_to)
       VALUES (?, ?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, ?, ?)`,
      [
        linkId,
        token,
        orderId,
        total,
        description.slice(0, 255) || null,
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
        `ChineXa: Payment request ${orderNumber} — ${amountText}. Pay securely here: ${url} (expires in ${hours}h)`
      ).catch((e) => ({ success: false, error: String(e) }));
      delivery.push({ channel: "sms", ok: !!r.success, error: r.success ? undefined : r.error });
    }

    if (channels.includes("email")) {
      const r = await sendEmail({
        to: emailTo,
        subject: `Payment request from ChineXa — ${amountText}`,
        html: `
          <p>Hello ${customerName},</p>
          <p>Here is your secure payment link${description ? ` for <strong>${description}</strong>` : ""}.</p>
          <p style="font-size:20px;font-weight:700;margin:16px 0;">${amountText}</p>
          <p style="margin:24px 0;">
            <a href="${url}" style="background:#7A4FA0;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Pay Now</a>
          </p>
          <p style="color:#666;font-size:13px;">This link expires in ${hours} hours. If the button doesn't work, copy and paste this into your browser:<br>${url}</p>
        `,
        text: `Payment request ${orderNumber} — ${amountText}. Pay here: ${url} (expires in ${hours}h)`,
      }).catch((e) => ({ success: false, error: String(e) }));
      delivery.push({ channel: "email", ok: !!r.success, error: r.success ? undefined : r.error });
    }

    return NextResponse.json({
      id: linkId,
      token,
      url,
      order_id: orderId,
      order_number: orderNumber,
      amount: total,
      expires_in_hours: hours,
      delivery,
    });
  } catch (error) {
    console.error("[POST /api/payment-links/quick]", error);
    return NextResponse.json({ error: "Could not create the payment link" }, { status: 500 });
  }
}
