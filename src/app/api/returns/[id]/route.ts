import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

// PUT /api/returns/[id] — admin updates return status
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const returns = await query<RowDataPacket[]>("SELECT * FROM order_returns WHERE id = ?", [id]);
    if (returns.length === 0) return NextResponse.json({ error: "Return not found" }, { status: 404 });
    const ret = returns[0];

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.status) { fields.push("status = ?"); values.push(body.status); }
    if (body.admin_note !== undefined) { fields.push("admin_note = ?"); values.push(body.admin_note); }
    if (body.refund_amount !== undefined) { fields.push("refund_amount = ?"); values.push(body.refund_amount); }

    if (fields.length > 0) {
      fields.push("updated_at = NOW()");
      values.push(id);
      await execute(`UPDATE order_returns SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    // When return is approved → update order status to 'returned' + restore stock
    if (body.status === "approved") {
      await execute("UPDATE orders SET status = 'returned' WHERE id = ?", [ret.order_id]);
      await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'returned', 'Return approved by admin')", [ret.order_id]);

      // Restore stock
      const orderItems = await query<RowDataPacket[]>("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [ret.order_id]);
      for (const item of orderItems) {
        if (item.product_id) {
          await execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [item.quantity, item.product_id]);
        }
      }

      // Deduct loyalty points if they were awarded
      if (ret.customer_id) {
        const earnedPoints = await query<RowDataPacket[]>(
          "SELECT id, points FROM customer_points WHERE customer_id = ? AND reference_id = ? AND type = 'purchase'",
          [ret.customer_id, ret.order_id]
        );
        for (const ep of earnedPoints) {
          const refundId = `pts-refund-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`;
          await execute(
            "INSERT INTO customer_points (id, customer_id, points, type, reference_id, description) VALUES (?, ?, ?, 'refund', ?, ?)",
            [refundId, ret.customer_id, -Math.abs(Number(ep.points)), ret.order_id, `Points deducted for returned order ${ret.order_number}`]
          );
        }

        // Notify customer
        const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await execute(
          "INSERT INTO customer_notifications (id, customer_id, type, title, message) VALUES (?, ?, 'order', ?, ?)",
          [notifId, ret.customer_id, "Return Approved", `Your return for order ${ret.order_number} has been approved. Refund of ৳${Number(ret.refund_amount || body.refund_amount || 0).toLocaleString()} will be processed.`]
        ).catch(() => {});
      }
    }

    // When return is rejected → notify customer
    if (body.status === "rejected" && ret.customer_id) {
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await execute(
        "INSERT INTO customer_notifications (id, customer_id, type, title, message) VALUES (?, ?, 'order', ?, ?)",
        [notifId, ret.customer_id, "Return Rejected", `Your return request for order ${ret.order_number} has been rejected.${body.admin_note ? ` Reason: ${body.admin_note}` : ""}`]
      ).catch(() => {});
    }

    // When refunded → update payment status
    if (body.status === "refunded") {
      await execute("UPDATE orders SET payment_status = 'refunded' WHERE id = ?", [ret.order_id]);
    }

    await logActivity(`Return ${body.status || "updated"}`, "order", id, `Order ${ret.order_number}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
