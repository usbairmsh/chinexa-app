import crypto from "crypto";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { getTrackingConfig } from "@/lib/seo";

// ─── Server-side Meta Purchase (from the backend, no browser involved) ─────────
// Used for EPS orders: the authoritative Purchase must fire only when payment
// actually SETTLES (settleEpsOrder), not when the customer is redirected to the
// gateway — otherwise abandoned payments would count as sales. The browser can't
// be relied on here (the customer may never return to our site), so this posts
// directly to the Conversions API.
//
// The event id is DETERMINISTIC (`purchase:<orderId>`), so if the same order is
// ever also reported from the browser, Meta deduplicates them. It also makes
// this idempotent: calling it twice for one order sends the same event id, which
// Meta collapses.

const GRAPH_VERSION = "v21.0";

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const hashEmail = (v?: string | null) => (v && v.trim() ? sha256(v.trim().toLowerCase()) : undefined);
const hashPhone = (v?: string | null) => {
  const d = (v || "").replace(/[^0-9]/g, "");
  return d ? sha256(d) : undefined;
};

/**
 * Fire a server-side Purchase for a paid order. Best-effort and self-contained:
 * never throws, no-ops unless Meta CAPI is configured + enabled.
 */
export async function sendMetaPurchase(orderId: string): Promise<void> {
  try {
    const cfg = await getTrackingConfig();
    const pixelId = (cfg.meta_pixel || "").trim();
    const token = (cfg.meta_capi_token || "").trim();
    if (!cfg.meta_events_enabled || !cfg.meta_capi_enabled || !pixelId || !token) return;

    const orders = await query<RowDataPacket[]>(
      `SELECT id, order_number, total, customer_name, customer_phone, customer_id FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    if (orders.length === 0) return;
    const order = orders[0];

    // Best-effort email from the shipping address (orders don't store it directly).
    let email: string | null = null;
    try {
      const addr = await query<RowDataPacket[]>(
        "SELECT email FROM order_addresses WHERE order_id = ? AND type = 'shipping' LIMIT 1",
        [orderId]
      );
      email = (addr[0]?.email as string) || null;
    } catch {
      /* optional */
    }

    const items = await query<RowDataPacket[]>(
      "SELECT product_id, quantity, unit_price FROM order_items WHERE order_id = ?",
      [orderId]
    );
    const contents = items
      .filter((i) => i.product_id) // synthetic (payment-link) lines have none
      .map((i) => ({ id: String(i.product_id), quantity: Number(i.quantity) || 1, item_price: Number(i.unit_price) || 0 }));

    const userData: Record<string, unknown> = {
      em: hashEmail(email),
      ph: hashPhone(order.customer_phone as string),
    };
    for (const k of Object.keys(userData)) if (userData[k] === undefined) delete userData[k];

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          // Deterministic id → dedup with any browser Purchase + idempotent on retry.
          event_id: `purchase:${order.id}`,
          action_source: "website",
          user_data: userData,
          custom_data: {
            currency: "BDT",
            value: Number(order.total) || 0,
            content_type: "product",
            content_ids: contents.map((c) => c.id),
            contents,
            order_id: order.order_number,
          },
        },
      ],
    };
    if (cfg.meta_test_event_code) payload.test_event_code = cfg.meta_test_event_code;

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[meta-capi] Purchase failed:", res.status, data?.error?.message || data);
    }
  } catch (err) {
    console.error("[meta-capi] sendMetaPurchase error:", err);
  }
}
