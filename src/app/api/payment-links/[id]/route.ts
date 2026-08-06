import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { requirePermission } from "@/lib/admin-permissions-server";
import { ensurePaymentLinkTables } from "@/lib/migrate-payment-links";
import { paymentLinkUrl } from "@/lib/payment-links";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ─── PUT /api/payment-links/[id] ──────────────────────────────────────────────
// Two actions: { action: "revoke" } and { action: "resend", via, to }.
//
// Resend deliberately re-sends the EXISTING token rather than minting a new one.
// A customer who already has the first message would otherwise end up holding
// two live links for the same order.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "accounting", "edit");
  if (denied) return denied;

  try {
    await ensurePaymentLinkTables();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const rows = await query<RowDataPacket[]>(
      `SELECT pl.*, o.order_number, o.customer_name, o.payment_status,
              (pl.expires_at <= NOW()) AS is_expired,
              TIMESTAMPDIFF(HOUR, NOW(), pl.expires_at) AS hours_left
         FROM payment_links pl
         JOIN orders o ON o.id = pl.order_id
        WHERE pl.id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    const link = rows[0];

    if (action === "revoke") {
      if (link.status === "paid" || link.payment_status === "paid") {
        return NextResponse.json({ error: "This link has already been paid." }, { status: 409 });
      }
      await execute("UPDATE payment_links SET status = 'revoked' WHERE id = ?", [id]);
      return NextResponse.json({ success: true, status: "revoked" });
    }

    if (action === "resend") {
      if (link.status !== "active" || Number(link.is_expired) === 1) {
        return NextResponse.json(
          { error: "This link is no longer active. Create a new one instead." },
          { status: 409 }
        );
      }
      const via = String(body.via || "");
      const to = String(body.to || "").trim();
      const url = paymentLinkUrl(String(link.token));
      const amount = Number(link.amount) || 0;
      const amountText = `BDT ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const orderNo = String(link.order_number);
      const hoursLeft = Math.max(1, Number(link.hours_left) || 1);

      if (via === "sms") {
        if (!to) return NextResponse.json({ error: "A phone number is required." }, { status: 400 });
        const r = await sendSms(
          normalizePhone(to),
          `ChineXa: Payment for order ${orderNo} — ${amountText}. Pay securely here: ${url} (expires in ${hoursLeft}h)`
        );
        if (!r.success) return NextResponse.json({ error: r.error || "SMS failed to send" }, { status: 502 });
      } else if (via === "email") {
        if (!isEmail(to)) return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
        const r = await sendEmail({
          to,
          subject: `Payment link for your ChineXa order ${orderNo}`,
          html: `
            <p>Hello ${link.customer_name || "there"},</p>
            <p>Here is your secure payment link for order <strong>${orderNo}</strong>.</p>
            <p style="font-size:20px;font-weight:700;margin:16px 0;">${amountText}</p>
            <p style="margin:24px 0;">
              <a href="${url}" style="background:#2f6f4e;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Pay Now</a>
            </p>
            <p style="color:#666;font-size:13px;">This link expires in ${hoursLeft} hours. If the button doesn't work, copy and paste this into your browser:<br>${url}</p>
          `,
          text: `Payment for order ${orderNo} — ${amountText}. Pay here: ${url} (expires in ${hoursLeft}h)`,
        });
        if (!r.success) return NextResponse.json({ error: r.error || "Email failed to send" }, { status: 502 });
      } else {
        return NextResponse.json({ error: "via must be 'sms' or 'email'" }, { status: 400 });
      }

      await execute("UPDATE payment_links SET sent_via = ?, sent_to = ? WHERE id = ?", [via, to.slice(0, 255), id]);
      return NextResponse.json({ success: true, sent: via });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[PUT /api/payment-links/[id]]", error);
    return NextResponse.json({ error: "Could not update the payment link" }, { status: 500 });
  }
}

// ─── DELETE /api/payment-links/[id] ───────────────────────────────────────────
// Removes the record entirely. A PAID link is kept — it is the audit trail for
// money that actually moved, so deleting it would erase how that order was paid.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "accounting", "delete");
  if (denied) return denied;

  try {
    await ensurePaymentLinkTables();
    const { id } = await params;
    const rows = await query<RowDataPacket[]>("SELECT status FROM payment_links WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Payment link not found" }, { status: 404 });
    if (rows[0].status === "paid") {
      return NextResponse.json(
        { error: "A paid link is kept as a payment record and cannot be deleted." },
        { status: 409 }
      );
    }
    await execute("DELETE FROM payment_links WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/payment-links/[id]]", error);
    return NextResponse.json({ error: "Could not delete the payment link" }, { status: 500 });
  }
}
