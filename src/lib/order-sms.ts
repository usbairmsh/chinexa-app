import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { sendSms } from "@/lib/sms";
import { getCustomerTier } from "@/lib/promotions";

// Order-creation SMS: when the admin's "Order SMS notifications" feature is on,
// send the customer an order-confirmation SMS (with an auto-generated track-order
// link) and notify the selected admin number(s) with the order + customer
// details. All best-effort — a gateway failure must never break order creation.
//
// Config is stored under the `order_sms` settings key:
//   { admin_ids: string[] }   // which admin_users receive the admin SMS
// The on/off switch lives in the `features` key as `order_sms` (consistent with
// the other feature toggles).

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

function parseJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

/** Read the two independent order-SMS toggles (default false each). */
async function orderSmsFlags(): Promise<{ customer: boolean; admin: boolean }> {
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'features' LIMIT 1");
    const features = rows.length ? parseJson(rows[0].value) : null;
    return {
      customer: !!(features && features.order_sms_customer === true),
      admin: !!(features && features.order_sms_admin === true),
    };
  } catch {
    return { customer: false, admin: false };
  }
}

/** Selected admin recipient ids from the order_sms settings key. */
async function orderSmsAdminIds(): Promise<string[]> {
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'order_sms' LIMIT 1");
    const cfg = rows.length ? parseJson(rows[0].value) : null;
    const ids = cfg?.admin_ids;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

interface OrderSmsInput {
  orderNumber: string;
  total: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  customerId: string | null;
  createdAt: Date;
}

const taka = (n: number) => `৳${Math.round(Number(n) || 0).toLocaleString("en-BD")}`;

function formatWhen(d: Date): string {
  // Dhaka-local, compact: "25 Jul 2026, 3:42 PM"
  try {
    return d.toLocaleString("en-GB", {
      timeZone: "Asia/Dhaka",
      day: "2-digit", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch {
    return d.toISOString();
  }
}

/**
 * Fire order-creation SMS. Safe to await without try/catch at the call site —
 * it self-contains all errors and never throws.
 */
export async function sendOrderCreationSms(input: OrderSmsInput): Promise<void> {
  try {
    const flags = await orderSmsFlags();
    if (!flags.customer && !flags.admin) return; // neither toggle on → nothing to do

    const when = formatWhen(input.createdAt);
    const method = (input.paymentMethod || "COD").toUpperCase();
    const trackUrl = `${siteUrl}/track-order?order=${encodeURIComponent(input.orderNumber)}`;

    // ─── Customer SMS (order confirmation + track link) — its own toggle ───
    if (flags.customer && input.customerPhone) {
      const customerMsg =
        `ChineXa: Order ${input.orderNumber} placed successfully. ` +
        `Amount ${taka(input.total)} (${method}), ${when}. ` +
        `Track: ${trackUrl}`;
      await sendSms(input.customerPhone, customerMsg);
    }

    // ─── Admin SMS (order + customer name/tier/phone) — its own toggle ───
    const adminIds = flags.admin ? await orderSmsAdminIds() : [];
    if (flags.admin && adminIds.length > 0) {
      // Resolve the reviewer/customer tier (guests → none).
      let tierName = "Guest";
      if (input.customerId) {
        try {
          const tier = await getCustomerTier(input.customerId);
          if (tier?.name) tierName = tier.name;
        } catch { /* keep "Guest" */ }
      }

      const placeholders = adminIds.map(() => "?").join(",");
      const admins = await query<RowDataPacket[]>(
        `SELECT phone FROM admin_users WHERE id IN (${placeholders}) AND phone IS NOT NULL AND phone <> ''`,
        adminIds
      );

      const adminMsg =
        `New order ${input.orderNumber} — ${taka(input.total)} (${method}), ${when}. ` +
        `Customer: ${input.customerName} [${tierName}], ${input.customerPhone}.`;

      for (const a of admins) {
        const phone = String(a.phone || "").trim();
        if (phone) await sendSms(phone, adminMsg);
      }
    }
  } catch (err) {
    console.error("[sendOrderCreationSms] failed:", err);
  }
}
