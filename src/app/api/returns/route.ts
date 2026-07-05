import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/returns — list all returns (admin) or by customer_id
export async function GET(req: NextRequest) {
  try {
    const customerId = req.nextUrl.searchParams.get("customer_id");
    const orderId = req.nextUrl.searchParams.get("order_id");

    let sql = "SELECT * FROM order_returns";
    const params: string[] = [];

    if (customerId) {
      sql += " WHERE customer_id = ?";
      params.push(customerId);
    } else if (orderId) {
      sql += " WHERE order_id = ?";
      params.push(orderId);
    }

    sql += " ORDER BY created_at DESC";

    const rows = await query<RowDataPacket[]>(sql, params);
    return NextResponse.json(rows.map((r) => ({
      ...r,
      refund_amount: r.refund_amount != null ? Number(r.refund_amount) : null,
      items: typeof r.items === "string" ? JSON.parse(r.items) : r.items || [],
    })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/returns — customer requests a return
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validate([
      { field: "order_id", value: body.order_id, rules: ["required", "string"], label: "Order" },
      { field: "reason", value: body.reason, rules: ["required", { oneOf: ["damaged", "wrong_item", "not_as_described", "changed_mind", "defective", "other"] }], label: "Reason" },
    ]);
    if (err) return validationError(err);

    // Verify order exists and is delivered
    const orders = await query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1", [body.order_id, body.order_id]);
    if (orders.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = orders[0];

    if (order.status !== "received") {
      return NextResponse.json({ error: "Returns can only be requested for delivered orders" }, { status: 400 });
    }

    // Check if return already exists for this order
    const existing = await query<RowDataPacket[]>("SELECT id FROM order_returns WHERE order_id = ? AND status NOT IN ('rejected')", [order.id]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "A return request already exists for this order" }, { status: 409 });
    }

    // Check 7-day return window
    const orderDate = new Date(order.created_at as string);
    const daysSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceOrder > 7) {
      return NextResponse.json({ error: "Return window has expired. Returns must be requested within 7 days of delivery." }, { status: 400 });
    }

    const id = `ret-${Date.now()}`;
    await execute(
      "INSERT INTO order_returns (id, order_id, order_number, customer_id, customer_name, reason, description, status, refund_amount, items) VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)",
      [
        id,
        order.id,
        order.order_number,
        order.customer_id || null,
        order.customer_name,
        body.reason,
        body.description || null,
        Number(order.total) || 0,
        JSON.stringify(body.items || []),
      ]
    );

    // Notify customer
    if (order.customer_id) {
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await execute(
        "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, 'order', ?, ?, ?)",
        [notifId, order.customer_id, "Return Request Submitted", `Your return request for order ${order.order_number} has been submitted. We'll review it shortly.`, `/dashboard/orders/${order.order_number}`]
      ).catch(() => {});
    }

    await logActivity("Return requested", "order", id, `Order ${order.order_number}`);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
