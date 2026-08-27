import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { sendOrderCreationSms } from "@/lib/order-sms";
import { sendOrderConfirmationEmail } from "@/lib/order-email";
import { notifyAdmin } from "@/lib/notify";

// ─── Order confirmation: the single place notifications are sent ─────────────
// An order being PLACED is not an order being CONFIRMED. Previously the customer
// SMS/email and the admin alert all fired at creation, which meant an EPS
// customer was told "order confirmed" the instant they were redirected to the
// gateway — before any money moved, and even if they abandoned the payment. The
// admin got a new-order alert for the same non-sale.
//
// Confirmation now happens at exactly two points, and both call this:
//   • COD  — when an admin moves the order to `confirmed` (they accept it)
//   • EPS  — automatically, the moment payment genuinely settles
//
// Guarded by orders.confirmation_sent so an order can never be announced twice,
// no matter how many times it is re-confirmed, retried, or reconciled. The flag
// is set BEFORE sending: a duplicate SMS/email to a customer is worse than a
// missed one, and the sends are individually best-effort anyway.

let ensured = false;

/** Idempotent: adds the confirmation_sent flag to existing deployments. */
export async function ensureConfirmationColumn(): Promise<void> {
  if (ensured) return;
  const cols = await query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'confirmation_sent'`
  );
  if (cols.length === 0) {
    await execute("ALTER TABLE orders ADD COLUMN confirmation_sent BOOLEAN DEFAULT FALSE");
  }
  ensured = true;
}

/**
 * Send the customer confirmation (SMS + email) and the admin new-order alert for
 * an order that has just been confirmed. Safe to call more than once — only the
 * first call for a given order actually sends.
 *
 * Never throws: notifications must not be able to fail a payment settlement or
 * an admin status change.
 */
export async function sendOrderConfirmedNotifications(orderId: string): Promise<void> {
  try {
    await ensureConfirmationColumn();

    // Claim the send atomically. Only the caller whose UPDATE matches a row that
    // hadn't been announced proceeds, so concurrent confirm + reconcile can't
    // both notify.
    const res = await execute(
      "UPDATE orders SET confirmation_sent = TRUE WHERE id = ? AND (confirmation_sent = FALSE OR confirmation_sent IS NULL)",
      [orderId]
    );
    const affected = (res as { affectedRows?: number })?.affectedRows ?? 0;
    if (affected === 0) return; // already announced

    const orders = await query<RowDataPacket[]>(
      `SELECT id, order_number, customer_id, customer_name, customer_phone, payment_method,
              subtotal, shipping_cost, discount, tax, total, coupon_code, created_at
         FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    if (orders.length === 0) return;
    const o = orders[0];

    const items = await query<RowDataPacket[]>(
      "SELECT product_name, quantity, unit_price FROM order_items WHERE order_id = ?",
      [orderId]
    );

    // Recipient: the address captured for THIS order wins, else the customer's
    // saved profile email.
    let email: string | null = null;
    try {
      const addr = await query<RowDataPacket[]>(
        "SELECT email FROM order_addresses WHERE order_id = ? AND type = 'shipping' LIMIT 1",
        [orderId]
      );
      email = (addr[0]?.email as string) || null;
      if (!email && o.customer_id) {
        const c = await query<RowDataPacket[]>("SELECT email FROM customers WHERE id = ? LIMIT 1", [o.customer_id]);
        email = (c[0]?.email as string) || null;
      }
    } catch { /* best-effort */ }

    const orderNumber = String(o.order_number);
    const total = Number(o.total) || 0;
    const paymentMethod = String(o.payment_method || "COD");

    await notifyAdmin(
      "order",
      `New order ${orderNumber}`,
      `${o.customer_name} — ৳${total.toLocaleString("en-BD")} via ${paymentMethod} (${items.length} item${items.length === 1 ? "" : "s"})`,
      `/admin/orders/${orderId}`
    ).catch(() => {});

    await sendOrderCreationSms({
      orderNumber,
      total,
      paymentMethod,
      customerName: String(o.customer_name || ""),
      customerPhone: String(o.customer_phone || ""),
      customerId: (o.customer_id as string) || null,
      createdAt: new Date(o.created_at as string),
    }).catch(() => {});

    await sendOrderConfirmationEmail({
      orderNumber,
      total,
      subtotal: Number(o.subtotal) || 0,
      shipping: Number(o.shipping_cost) || 0,
      discount: Number(o.discount) || 0,
      tax: Number(o.tax) || 0,
      couponCode: (o.coupon_code as string) || null,
      paymentMethod,
      customerName: String(o.customer_name || ""),
      customerEmail: email,
      customerPhone: String(o.customer_phone || ""),
      customerId: (o.customer_id as string) || null,
      items: items.map((i) => ({
        name: String(i.product_name || "Item"),
        quantity: Number(i.quantity) || 1,
        price: Number(i.unit_price) || 0,
      })),
      createdAt: new Date(o.created_at as string),
    }).catch(() => {});
  } catch (err) {
    console.error("[sendOrderConfirmedNotifications] failed:", err);
  }
}
