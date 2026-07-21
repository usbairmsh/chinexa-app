import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, escapeLike } from "@/lib/db";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Public order tracking by a SINGLE query that may be either a phone number
// (any format — with or without the +880 country code) or an order id / order
// number (full "ORD-000527" or just the trailing digits "527").
//
// Privacy: this is a public, unauthenticated endpoint reachable by anyone, so
// it returns a REDACTED tracking view only — status, timeline, items, totals —
// and never the customer's name / phone / address. That's the same stance the
// order-id-only branch of GET /api/orders/[id] already takes. Matching by phone
// still returns only the tracking view (not PII), so knowing a phone number
// can't be used to harvest addresses.

// Produce the candidate normalized forms of a phone number so a match works
// whether or not the shopper typed the country code. Returns [] if the input
// doesn't look like a phone (lets the caller fall through to order-id matching).
function phoneCandidates(raw: string): string[] {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 6) return []; // too short to be a BD phone number
  const set = new Set<string>();
  // Local 11-digit form starting 0 (01XXXXXXXXX)
  let local = digits;
  if (local.startsWith("880")) local = "0" + local.slice(3);
  else if (!local.startsWith("0")) local = "0" + local;
  set.add(local);                       // 01712345678
  set.add(local.replace(/^0/, ""));     // 1712345678
  set.add("+880" + local.slice(1));     // +8801712345678
  set.add("880" + local.slice(1));      // 8801712345678
  set.add("+88" + local);               // +8801712345678 (alt)
  return [...set];
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") || "").trim();
    if (!q) return NextResponse.json({ error: "Enter an order number or phone number." }, { status: 400 });
    if (q.length > 60) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let order: RowDataPacket | undefined;

    // 1) Phone match — most recent order for a matching phone (any format).
    const candidates = phoneCandidates(q);
    if (candidates.length > 0) {
      const placeholders = candidates.map(() => "?").join(",");
      const rows = await query<RowDataPacket[]>(
        `SELECT * FROM orders WHERE customer_phone IN (${placeholders}) ORDER BY created_at DESC LIMIT 1`,
        candidates
      );
      if (rows.length > 0) order = rows[0];
    }

    // 2) Order id / number match, exact first, then partial (the trailing part
    //    of the order number — so "527" finds "ORD-000527"). Only when the
    //    phone lookup didn't already find something.
    if (!order) {
      const exact = await query<RowDataPacket[]>(
        "SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1",
        [q, q]
      );
      if (exact.length > 0) {
        order = exact[0];
      } else {
        // Partial: match the query as a suffix of the order number (case-
        // insensitive). Newest first so a short numeric query resolves to the
        // most recent matching order. Require at least 3 chars to avoid a
        // 1-digit query fanning out across the whole table.
        const bare = q.replace(/^ord-?/i, ""); // let "527" or "ORD-527" both work
        if (bare.length >= 3) {
          const like = `%${escapeLike(bare)}`;
          const rows = await query<RowDataPacket[]>(
            "SELECT * FROM orders WHERE order_number LIKE ? OR id LIKE ? ORDER BY created_at DESC LIMIT 1",
            [like, like]
          );
          if (rows.length > 0) order = rows[0];
        }
      }
    }

    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [items, timeline] = await Promise.all([
      query<RowDataPacket[]>("SELECT product_name, quantity, unit_price, total_price FROM order_items WHERE order_id = ?", [order.id]),
      query<RowDataPacket[]>("SELECT status, note, created_at FROM order_timeline WHERE order_id = ? ORDER BY created_at", [order.id]),
    ]);

    // Redacted tracking view — no name / phone / address.
    return NextResponse.json({
      order_number: order.order_number,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      created_at: order.created_at,
      subtotal: Number(order.subtotal) || 0,
      shipping_cost: Number(order.shipping_cost) || 0,
      discount: Number(order.discount) || 0,
      total: Number(order.total) || 0,
      items: items.map((i) => ({
        product_name: i.product_name,
        quantity: Number(i.quantity) || 0,
        unit_price: Number(i.unit_price) || 0,
        total_price: Number(i.total_price) || 0,
      })),
      timeline,
    });
  } catch (error: unknown) {
    return publicServerError("GET /api/track-order", error);
  }
}
