import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { checkEpsStatus, epsIsPaid, isEpsConfigured } from "@/lib/eps";

export const dynamic = "force-dynamic";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com").replace(/\/+$/, "");

// GET /api/payment/eps/return?order_id=…&type=success|fail|cancel
// EPS redirects the customer here after payment. We NEVER trust the redirect
// type alone — we verify server-side via CheckMerchantTransactionStatus, update
// the order accordingly, then redirect the customer to a friendly result page.
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order_id") || "";
  const type = req.nextUrl.searchParams.get("type") || "";
  const result = (state: string, extra = "") =>
    NextResponse.redirect(`${SITE_URL}/checkout/result?order=${encodeURIComponent(orderId)}&state=${state}${extra}`);

  try {
    if (!orderId) return result("fail");

    const orders = await query<RowDataPacket[]>(
      "SELECT id, order_number, total, status, payment_status, eps_merchant_txn_id FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );
    if (orders.length === 0) return result("fail");
    const order = orders[0];

    // Already settled (e.g. customer refreshed) — send straight to the result.
    if (order.payment_status === "paid") return result("success");

    const merchantTxnId = String(order.eps_merchant_txn_id || "");
    if (!merchantTxnId || !isEpsConfigured()) return result("fail");

    // Explicit cancel: mark cancelled attempt, keep the order recoverable.
    if (type === "cancel") {
      return result("cancel");
    }

    // Authoritative verification.
    const status = await checkEpsStatus(merchantTxnId);

    // Anti-tamper: the verified amount must match the order total.
    const amountOk = Math.round(status.totalAmount) === Math.round(Number(order.total) || 0);

    if (epsIsPaid(status) && amountOk) {
      // Mark paid + confirmed. Stock was already deducted at order creation
      // (non-preorder orders create with stock_deducted = 1), so we only flip
      // the status and record the timeline + EPS reference.
      await execute(
        "UPDATE orders SET payment_status = 'paid', status = 'confirmed', eps_transaction_id = COALESCE(?, eps_transaction_id) WHERE id = ? AND payment_status <> 'paid'",
        [String(status.raw?.TransactionId || "") || null, orderId]
      );
      await execute(
        "INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'confirmed', ?)",
        [orderId, `Payment received via EPS (${status.financialEntity || "online"}). Verified.`]
      );
      return result("success");
    }

    // Failed / mismatched.
    await execute("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status <> 'paid'", [orderId]);
    return result("fail", amountOk ? "" : "&reason=amount");
  } catch (error: unknown) {
    console.error("[GET /api/payment/eps/return]", error);
    return result("fail");
  }
}
