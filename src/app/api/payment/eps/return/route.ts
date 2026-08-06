import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { settleEpsOrder } from "@/lib/eps-settle";

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com").replace(/\/+$/, "");

// GET /api/payment/eps/return?order_id=…&type=success|fail|cancel
// EPS redirects the customer here after payment. The `type` is only a hint — the
// order is settled by verifying with EPS server-side (settleEpsOrder), which
// checks every payment attempt and the amount. A customer who abandons here is
// still covered: the reconcile cron settles the payment even if this leg never
// runs, and the order keeps its Pay Now option until the window closes.
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order_id") || "";
  const type = req.nextUrl.searchParams.get("type") || "";
  const result = (state: string, extra = "") =>
    NextResponse.redirect(`${SITE_URL}/checkout/result?order=${encodeURIComponent(orderId)}&state=${state}${extra}`);

  try {
    if (!orderId) return result("fail");

    // An explicit cancel still gets verified — the customer may have paid and
    // then landed on the cancel URL. Verification is authoritative either way.
    const settle = await settleEpsOrder(orderId);
    if (settle.settled) return result("success");

    if (type === "cancel") return result("cancel");
    if (settle.reason === "amount_mismatch") return result("fail", "&reason=amount");

    // Unpaid: leave the order payable (Pay Now stays available until the window
    // closes) rather than hard-failing it, so the customer can simply retry.
    const rows = await query<RowDataPacket[]>(
      "SELECT payment_status FROM orders WHERE id = ? LIMIT 1", [orderId]
    );
    if (rows.length && rows[0].payment_status === "paid") return result("success");
    return result("fail");
  } catch (error: unknown) {
    console.error("[GET /api/payment/eps/return]", error);
    return result("fail");
  }
}
