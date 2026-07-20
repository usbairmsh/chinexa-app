import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { insertCustomerPoints } from "@/lib/points";
import { checkInstantReturnAbuseRules } from "@/lib/points-deduction-engine";
import { requirePermission } from "@/lib/admin-permissions-server";

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

    if (body.status) {
      if (!["requested", "approved", "rejected", "received", "refunded"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid return status" }, { status: 400 });
      }
      // Approve/reject/refund is the return-adjacent "approve" workflow;
      // any other status transition falls back to the general order-handling
      // permission.
      const action = ["approved", "rejected", "refunded"].includes(body.status) ? "approve" : "handle_orders";
      const denied = await requirePermission(req, "orders", action);
      if (denied) return denied;
      fields.push("status = ?"); values.push(body.status);
    }
    if (body.admin_note !== undefined) { fields.push("admin_note = ?"); values.push(body.admin_note); }
    if (body.refund_amount !== undefined) { fields.push("refund_amount = ?"); values.push(body.refund_amount); }

    if (fields.length > 0) {
      fields.push("updated_at = NOW()");
      values.push(id);
      await execute(`UPDATE order_returns SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    // When return is approved → restore stock, reverse stats, update order status
    if (body.status === "approved") {
      const orderRows = await query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ?", [ret.order_id]);
      const order = orderRows.length > 0 ? orderRows[0] : null;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Set order status to returned
        await conn.execute("UPDATE orders SET status = 'returned', updated_at = NOW() WHERE id = ?", [ret.order_id]);

        // Restore stock using the flag to prevent double restore
        if (order && order.stock_deducted) {
          const [items] = await conn.execute<RowDataPacket[]>(
            "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?", [ret.order_id]
          );
          for (const item of items) {
            if (item.product_id) {
              if (item.variant_id) {
                await conn.execute(
                  "UPDATE product_variants SET stock = stock + ? WHERE id = ?",
                  [item.quantity, item.variant_id]
                );
              }
              await conn.execute(
                "UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?",
                [item.quantity, item.product_id]
              );
            }
          }
          await conn.execute("UPDATE orders SET stock_deducted = FALSE WHERE id = ?", [ret.order_id]);
        }

        // Reverse customer stats if revenue was counted
        if (order && order.revenue_counted && order.customer_id) {
          const orderTotal = Number(order.total) || 0;
          await conn.execute(
            "UPDATE customers SET total_spent = GREATEST(total_spent - ?, 0), total_orders = GREATEST(total_orders - 1, 0) WHERE id = ?",
            [orderTotal, order.customer_id]
          );
          await conn.execute("UPDATE orders SET revenue_counted = FALSE WHERE id = ?", [ret.order_id]);
        }

        // Decrement coupon usage on return
        if (order && order.coupon_code) {
          await conn.execute("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?", [order.coupon_code]);
        }

        await conn.commit();
        conn.release();
      } catch (txError) {
        await conn.rollback().catch(() => {});
        conn.release();
        throw txError;
      }

      // Timeline entry
      await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'returned', 'Return approved by admin')", [ret.order_id]);

      // Deduct loyalty points if they were awarded
      if (ret.customer_id) {
        try {
          const earnedPoints = await query<RowDataPacket[]>(
            "SELECT id, points FROM customer_points WHERE customer_id = ? AND reference_id = ? AND type = 'purchase'",
            [ret.customer_id, ret.order_id]
          );
          for (const ep of earnedPoints) {
            await insertCustomerPoints({
              customerId: ret.customer_id as string,
              points: -Math.abs(Number(ep.points)),
              type: "refund",
              referenceId: ret.order_id as string,
              description: `Points deducted for returned order ${ret.order_number}`,
            });
          }
        } catch {
          // Don't fail the return if points reversal fails
        }

        // Notify customer
        const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await execute(
          "INSERT INTO customer_notifications (id, customer_id, type, title, message) VALUES (?, ?, 'order', ?, ?)",
          [notifId, ret.customer_id, "Return Approved", `Your return for order ${ret.order_number} has been approved. Refund of ৳${Number(ret.refund_amount || body.refund_amount || 0).toLocaleString()} will be processed.`]
        ).catch(() => {});

        // Instant Return-Abuse rules re-check this customer the moment a
        // return is approved, instead of waiting for the next scheduled tick.
        await checkInstantReturnAbuseRules(ret.customer_id as string).catch((err) => {
          console.error("[returns] instant return-abuse check failed:", err);
        });
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

    // When refunded → update payment status. Only when the order was actually
    // PAID: an unpaid COD order being returned had no money to give back, and
    // marking it 'refunded' anyway would corrupt what that status means to
    // the accounting section (whose cash figures treat 'refunded' as "money
    // came in and went back out"). Matches the same guard in the
    // cancel/return reversal branches of PUT /api/orders/[id].
    if (body.status === "refunded") {
      await execute("UPDATE orders SET payment_status = 'refunded' WHERE id = ? AND payment_status = 'paid'", [ret.order_id]);
    }

    await logActivity(`Return ${body.status || "updated"}`, "order", id, `Order ${ret.order_number}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
