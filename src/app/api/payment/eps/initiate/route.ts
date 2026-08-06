import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { initializeEps, isEpsConfigured, type EpsProduct } from "@/lib/eps";
import { recordAttempt, PAYMENT_WINDOW_MINUTES } from "@/lib/eps-settle";

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com").replace(/\/+$/, "");

/** Same normalisation the order routes use, so phone-based ownership matches. */
function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

// Orders that can never be paid for.
const UNPAYABLE_STATUSES = new Set(["cancelled", "returned", "received", "not_received"]);

// POST /api/payment/eps/initiate  { order_id }
// Starts an EPS payment for an already-created (pending) order and returns the
// gateway RedirectURL. The amount comes from the SERVER-SIDE order row, never
// from the client, and is re-verified on the return leg.
export async function POST(req: NextRequest) {
  try {
    if (!isEpsConfigured()) {
      return NextResponse.json({ error: "Online payment is not configured." }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id || "");
    if (!orderId) return NextResponse.json({ error: "order_id is required" }, { status: 400 });

    // age_minutes is computed by the DB so the payment-window check can't be
    // thrown off by a timezone difference between MySQL and the app container
    // (which could otherwise make a brand-new order look already expired).
    const orders = await query<RowDataPacket[]>(
      `SELECT id, order_number, customer_id, customer_name, customer_phone, total, status, payment_status,
              created_at, TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS age_minutes
       FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );
    if (orders.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = orders[0];

    // ─── Ownership ───
    // The caller must prove the order is theirs, by customer_id (signed-in) or
    // matching phone (guest). Without this, anyone who guesses an order id could
    // start a payment session and push that customer's name/phone/address into
    // the gateway payload.
    const claimCustomerId = String(body.customer_id || "").trim();
    const claimPhone = String(body.phone || "").trim();
    const ownsById = !!claimCustomerId && !!order.customer_id && String(order.customer_id) === claimCustomerId;
    const ownsByPhone = !!claimPhone && !!order.customer_phone
      && normalizePhone(claimPhone) === normalizePhone(String(order.customer_phone));
    if (!ownsById && !ownsByPhone) {
      return NextResponse.json({ error: "You can only pay for your own order." }, { status: 403 });
    }

    // ─── Payability ───
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
    }
    if (UNPAYABLE_STATUSES.has(String(order.status))) {
      return NextResponse.json({ error: "This order can no longer be paid for." }, { status: 409 });
    }
    // The payment window runs from order creation and is NOT extended by
    // retrying — otherwise an order could hold stock indefinitely.
    if (Number(order.age_minutes) >= PAYMENT_WINDOW_MINUTES) {
      return NextResponse.json(
        { error: `The ${PAYMENT_WINDOW_MINUTES}-minute payment window for this order has expired. Please place a new order.` },
        { status: 409 }
      );
    }

    // Shipping address (for customer details in the EPS payload).
    const addrRows = await query<RowDataPacket[]>(
      "SELECT name, phone, email, address_line_1, city, district, division, postal_code FROM order_addresses WHERE order_id = ? AND type = 'shipping' LIMIT 1",
      [orderId]
    );
    const addr = addrRows[0] || {};

    // Line items -> EPS ProductList.
    const itemRows = await query<RowDataPacket[]>(
      "SELECT product_name, quantity, unit_price FROM order_items WHERE order_id = ?",
      [orderId]
    );
    const products: EpsProduct[] = itemRows.map((it) => ({
      ProductName: String(it.product_name || "Item").slice(0, 120),
      NoOfItem: String(Number(it.quantity) || 1),
      ProductProfile: "general",
      ProductCategory: "beauty",
      ProductPrice: String(Number(it.unit_price) || 0),
    }));
    if (products.length === 0) {
      products.push({ ProductName: "Order", NoOfItem: "1", ProductProfile: "general", ProductCategory: "beauty", ProductPrice: String(Number(order.total) || 0) });
    }

    // Unique per attempt: order number + timestamp (>= 10 digits, unique).
    const merchantTxnId = `${String(order.order_number).replace(/[^0-9]/g, "").slice(-8)}${Date.now()}`.slice(0, 30);

    // Return legs carry the order id; the return route verifies server-side.
    const ret = (type: string) => `${SITE_URL}/api/payment/eps/return?order_id=${encodeURIComponent(orderId)}&type=${type}`;

    const { redirectUrl, transactionId } = await initializeEps({
      merchantTransactionId: merchantTxnId,
      customerOrderId: String(order.order_number),
      totalAmount: Number(order.total) || 0,
      successUrl: ret("success"),
      failUrl: ret("fail"),
      cancelUrl: ret("cancel"),
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0",
      customerName: String(addr.name || order.customer_name || "Customer"),
      customerEmail: String(addr.email || "noemail@chinexabd.com"),
      customerAddress: String(addr.address_line_1 || "N/A"),
      customerCity: String(addr.city || addr.district || "Dhaka"),
      customerState: String(addr.division || "Dhaka"),
      customerPostcode: String(addr.postal_code || "1200"),
      customerCountry: "BD",
      customerPhone: String(addr.phone || order.customer_phone || ""),
      products,
    });

    await execute(
      "UPDATE orders SET eps_merchant_txn_id = ?, eps_transaction_id = ?, payment_method = 'EPS' WHERE id = ?",
      [merchantTxnId, transactionId || null, orderId]
    );
    // Keep every attempt so a late-completed earlier one can still be found and
    // settled by reconciliation (see lib/eps-settle.ts).
    await recordAttempt(orderId, merchantTxnId, Number(order.total) || 0, transactionId).catch(() => {});

    return NextResponse.json({ redirect_url: redirectUrl });
  } catch (error: unknown) {
    console.error("[POST /api/payment/eps/initiate]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start payment." }, { status: 502 });
  }
}
