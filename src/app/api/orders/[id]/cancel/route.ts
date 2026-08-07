import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { publicServerError } from "@/lib/validate";
import { ensureOrderArchiveColumns } from "@/lib/migrate-order-archive";
import { getVerifiedCustomerId } from "@/lib/customer-session";
import { getVerifiedAdminId } from "@/lib/admin-session";

// Customer-initiated order cancellation. Mirrors the Returns pattern: no admin
// auth (customers have no server session cookie), but ownership is checked by
// requiring the caller to pass their customer_id and matching it to the order.
//
// A customer may cancel only while the order is still early in fulfilment —
// pre-order/pending/confirmed/processing. Cancelling performs the SAME
// reversal the admin "cancelled" status branch does (restore stock, reverse
// revenue/order counts, decrement coupon, refund-if-paid), AND archives the
// order (is_archived=1) so it lands in the admin Archive tab, exactly like an
// admin archive. All financial/stock writes run in one transaction.

const CANCELLABLE = new Set(["preorder", "pending", "confirmed", "processing"]);

async function restoreStock(conn: import("mysql2/promise").PoolConnection, orderId: string) {
  const [items] = await conn.execute<RowDataPacket[]>(
    "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?", [orderId]
  );
  for (const item of items) {
    if (!item.product_id) continue;
    if (item.variant_id) {
      await conn.execute("UPDATE product_variants SET stock = stock + ? WHERE id = ?", [item.quantity, item.variant_id]);
    }
    await conn.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [item.quantity, item.product_id]);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureOrderArchiveColumns();
    const { id: paramId } = await params;
    await req.json().catch(() => ({}));
    const isAdmin = !!getVerifiedAdminId(req);
    const sessionId = getVerifiedCustomerId(req);

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1", [paramId, paramId]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = rows[0];
    const id = order.id as string;
    const prevStatus = order.status as string;

    // Ownership derives from the SESSION (or admin) — a guessed customer_id must
    // not let anyone cancel another person's order. (Guest orders with no
    // customer_id can't be self-cancelled here; those go through support.)
    if (!isAdmin) {
      const ownerId = String(order.customer_id ?? "");
      if (!sessionId || !ownerId || ownerId !== sessionId) {
        return NextResponse.json({ error: "You can only cancel your own orders." }, { status: 403 });
      }
    }

    // Only early-stage orders are customer-cancellable.
    if (!CANCELLABLE.has(prevStatus)) {
      return NextResponse.json(
        { error: "This order can no longer be cancelled. Please contact support if you need help." },
        { status: 409 }
      );
    }

    const orderTotal = Number(order.total) || 0;
    const stockDeducted = Boolean(order.stock_deducted);
    const revenueCounted = Boolean(order.revenue_counted);

    // ─── Reversal + archive in one transaction (mirrors the admin cancel branch) ───
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute("UPDATE orders SET status = 'cancelled', is_archived = TRUE, archived_at = NOW(), updated_at = NOW() WHERE id = ?", [id]);

      if (stockDeducted) {
        await restoreStock(conn, id);
        await conn.execute("UPDATE orders SET stock_deducted = FALSE WHERE id = ?", [id]);
      }
      if (revenueCounted && order.customer_id) {
        await conn.execute(
          "UPDATE customers SET total_spent = GREATEST(total_spent - ?, 0), total_orders = GREATEST(total_orders - 1, 0) WHERE id = ?",
          [orderTotal, order.customer_id]
        );
        await conn.execute("UPDATE orders SET revenue_counted = FALSE WHERE id = ?", [id]);
      }
      if (order.coupon_code) {
        await conn.execute("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?", [order.coupon_code]);
      }
      if (order.payment_status === "paid") {
        await conn.execute("UPDATE orders SET payment_status = 'refunded' WHERE id = ?", [id]);
      }

      // Timeline entry
      await conn.execute(
        "INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'cancelled', ?)",
        [id, "Cancelled by customer"]
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // Customer notification (best-effort, outside the transaction)
    try {
      await query(
        "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, 'order', ?, ?, ?)",
        [
          `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          order.customer_id,
          "Order Cancelled",
          `Your order ${order.order_number} has been cancelled. If you were charged, a refund will be processed.`,
          `/dashboard/orders/${order.order_number}`,
        ]
      );
    } catch { /* non-critical */ }

    await logActivity("Order cancelled by customer", "order", id, `Order ${order.order_number}`);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("POST /api/orders/[id]/cancel", error);
  }
}
