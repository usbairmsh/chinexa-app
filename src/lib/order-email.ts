import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { sendEmail } from "@/lib/email";
import { getCustomerTier } from "@/lib/promotions";
import { orderConfirmationEmail, orderStatusEmail, adminOrderEmail, type EmailOrderItem } from "@/lib/email-templates";

// Order-lifecycle emails — the email counterpart of order-sms.ts. All sends are
// best-effort: the whole thing is wrapped so a provider failure can never break
// order creation or a status update. Customer email is OPTIONAL at checkout, so
// every customer send is guarded on an address being present.
//
// Toggles live in the `features` settings key (mirror the SMS ones):
//   order_email_customer   — send the customer an order-confirmation email
//   order_email_admin      — email selected admins on a new order
//   order_email_shipped    — email the customer when their order ships
//   order_email_delivered  — email the customer when delivered
// Admin recipient emails live under the `order_email` settings key:
//   { admin_emails: string[] }

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

function parseJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

async function readFeatures(): Promise<Record<string, unknown>> {
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'features' LIMIT 1");
    return (rows.length ? parseJson(rows[0].value) : null) || {};
  } catch { return {}; }
}

async function adminEmails(): Promise<string[]> {
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'order_email' LIMIT 1");
    const cfg = rows.length ? parseJson(rows[0].value) : null;
    const list = cfg?.admin_emails;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string" && x.includes("@")) : [];
  } catch { return []; }
}

async function storeName(): Promise<string> {
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'store_name' LIMIT 1");
    const v = rows.length ? parseJson(rows[0].value) ?? rows[0].value : null;
    return typeof v === "string" && v ? v : "ChineXa";
  } catch { return "ChineXa"; }
}

function formatWhen(d: Date): string {
  try {
    return d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return d.toISOString(); }
}

function trackLink(orderNumber: string): string {
  return `${siteUrl}/track-order?order=${encodeURIComponent(orderNumber)}`;
}

export interface OrderConfirmationEmailInput {
  orderNumber: string;
  total: number;
  // Breakdown, all optional — an older caller that only knows the total still
  // produces a valid email, just without the itemised lines.
  subtotal?: number;
  shipping?: number;
  discount?: number;
  tax?: number;
  couponCode?: string | null;
  paymentMethod: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  customerId: string | null;
  items: EmailOrderItem[];
  createdAt: Date;
}

/** Order-creation emails: confirmation to the customer + alert to admins.
 *  Safe to await with no try/catch — self-contained, never throws. */
export async function sendOrderConfirmationEmail(input: OrderConfirmationEmailInput): Promise<void> {
  try {
    const features = await readFeatures();
    const customerOn = features.order_email_customer === true;
    const adminOn = features.order_email_admin === true;
    if (!customerOn && !adminOn) return;

    const name = await storeName();
    const when = formatWhen(input.createdAt);
    const method = (input.paymentMethod || "COD").toUpperCase();
    const base = {
      orderNumber: input.orderNumber, customerName: input.customerName, total: input.total,
      subtotal: input.subtotal, shipping: input.shipping, discount: input.discount,
      tax: input.tax, couponCode: input.couponCode,
      paymentMethod: method, when, items: input.items, trackUrl: trackLink(input.orderNumber),
      siteUrl, storeName: name,
    };

    // ── Customer confirmation — only if we actually have an email ──
    if (customerOn && input.customerEmail) {
      const { subject, html, text } = orderConfirmationEmail(base);
      await sendEmail({ to: input.customerEmail, subject, html, text });
    }

    // ── Admin alert ──
    const admins = adminOn ? await adminEmails() : [];
    if (adminOn && admins.length > 0) {
      let tierName = "Guest";
      if (input.customerId) {
        try { const t = await getCustomerTier(input.customerId); if (t?.name) tierName = t.name; } catch { /* keep Guest */ }
      }
      const { subject, html, text } = adminOrderEmail({ ...base, customerPhone: input.customerPhone, tierName });
      for (const to of admins) await sendEmail({ to, subject, html, text });
    }
  } catch (err) {
    console.error("[sendOrderConfirmationEmail] failed:", err);
  }
}

// Per-status customer emails. Only the statuses shoppers care about are wired;
// each maps to its own feature toggle so admins control them independently.
const STATUS_EMAILS: Record<string, { flag: string; title: string; message: string }> = {
  shipped: { flag: "order_email_shipped", title: "Your order has shipped! 📦", message: "Good news — your order is on its way to you." },
  received: { flag: "order_email_delivered", title: "Your order has been delivered 🎉", message: "Your order has been delivered. We hope you love it!" },
};

export interface OrderStatusEmailInput {
  status: string;
  orderNumber: string;
  total: number;
  customerName: string;
  customerEmail: string | null;
}

/** Status-change customer email (shipped / delivered). Best-effort, never throws. */
export async function sendOrderStatusEmail(input: OrderStatusEmailInput): Promise<void> {
  try {
    const cfg = STATUS_EMAILS[input.status];
    if (!cfg || !input.customerEmail) return;

    const features = await readFeatures();
    if (features[cfg.flag] !== true) return;

    const name = await storeName();
    const { subject, html, text } = orderStatusEmail(
      {
        orderNumber: input.orderNumber, customerName: input.customerName, total: input.total,
        paymentMethod: "", when: "", items: [], trackUrl: trackLink(input.orderNumber),
        siteUrl, storeName: name,
      },
      { title: cfg.title, message: cfg.message },
    );
    await sendEmail({ to: input.customerEmail, subject, html, text });
  } catch (err) {
    console.error("[sendOrderStatusEmail] failed:", err);
  }
}
