import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { resolvePaymentLink, markLinkOpened } from "@/lib/payment-links";

export const dynamic = "force-dynamic";

// ─── GET /api/pay/[token] ─────────────────────────────────────────────────────
// PUBLIC. The token IS the credential — no session required, because the whole
// point is that a customer who has never signed in can pay.
//
// The response is deliberately REDACTED: order number, items and totals only.
// It never returns the customer's phone, email or full address. Someone who
// obtains the link (a forwarded screenshot, a shared phone) can pay the order,
// which is the intent — but they must not be handed the customer's PII too.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const resolved = await resolvePaymentLink(token);

    // Same 404 for "never existed" and "malformed" — never reveal whether a
    // given token was ever real, so the space can't be probed.
    if (!resolved) {
      return NextResponse.json({ error: "This payment link is not valid." }, { status: 404 });
    }
    const { link, order, blockedReason } = resolved;

    void markLinkOpened(String(link.id));

    // A standalone collection has no order, no items and no customer — the
    // amount and description are the whole of it.
    if (!order) {
      return NextResponse.json(
        {
          standalone: true,
          reference: link.reference,
          amount: Number(link.amount) || 0,
          description: link.description,
          items: [],
          expires_at: link.expires_at,
          payable: blockedReason === null,
          blocked_reason: blockedReason,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const items = await query<RowDataPacket[]>(
      "SELECT product_name, variant, quantity, unit_price, total_price FROM order_items WHERE order_id = ?",
      [order.id]
    );

    return NextResponse.json(
      {
        standalone: false,
        order_number: order.order_number,
        // First name only — enough for the customer to recognise the order as
        // theirs, without exposing the full identity to a link holder.
        customer_first_name: String(order.customer_name || "").split(" ")[0] || null,
        amount: Number(order.total) || 0,
        description: link.description,
        items: items.map((i) => ({
          name: i.product_name,
          variant: i.variant,
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          total_price: Number(i.total_price) || 0,
        })),
        expires_at: link.expires_at,
        payable: blockedReason === null,
        blocked_reason: blockedReason,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[GET /api/pay/[token]]", error);
    return NextResponse.json({ error: "Could not load this payment link." }, { status: 500 });
  }
}
