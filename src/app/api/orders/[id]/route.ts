import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orders = await query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1", [id, id]);
    if (orders.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const order = orders[0];
    const items = await query<RowDataPacket[]>("SELECT * FROM order_items WHERE order_id = ?", [order.id]);
    const addresses = await query<RowDataPacket[]>("SELECT * FROM order_addresses WHERE order_id = ?", [order.id]);
    const timeline = await query<RowDataPacket[]>("SELECT * FROM order_timeline WHERE order_id = ? ORDER BY created_at", [order.id]);
    return NextResponse.json({ ...order, items, billing_address: addresses.find((a) => a.type === "billing"), shipping_address: addresses.find((a) => a.type === "shipping"), timeline });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: paramId } = await params;
    const body = await req.json();

    // Resolve the actual database ID (param could be id or order_number)
    const orderRows = await query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1", [paramId, paramId]);
    if (orderRows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = orderRows[0];
    const id = order.id as string;

    if (body.status) {
      await execute("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [body.status, id]);
      await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, ?, ?)", [id, body.status, body.note || `Status changed to ${body.status}`]);

      // Send customer notification
      if (order.customer_id) {
        const notifMessages: Record<string, { title: string; message: string; type: string }> = {
          confirmed: { title: "Order Confirmed", message: `Your order ${order.order_number} has been confirmed and is being prepared.`, type: "order" },
          processing: { title: "Order Processing", message: `Your order ${order.order_number} is being processed.`, type: "order" },
          shipped: { title: "Order Shipped!", message: `Your order ${order.order_number} has been shipped and is on its way.`, type: "order" },
          on_delivery: { title: "Out for Delivery", message: `Your order ${order.order_number} is out for delivery. It will arrive soon!`, type: "order" },
          received: { title: "Order Delivered", message: `Your order ${order.order_number} has been delivered. Enjoy your purchase!`, type: "order" },
          not_received: { title: "Delivery Issue", message: `There was an issue with the delivery of order ${order.order_number}. Please contact support.`, type: "order" },
        };
        const notif = notifMessages[body.status];
        if (notif) {
          const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await execute(
            "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)",
            [notifId, order.customer_id, notif.type, notif.title, notif.message, `/dashboard/orders/${order.order_number}`]
          ).catch(() => {});
        }
      }

      const paymentMethod = (order.payment_method as string || "").toLowerCase();
      const isCOD = paymentMethod === "cod";

      // COD: payment becomes 'paid' when customer receives the order
      if (body.status === "received" && isCOD && order.payment_status !== "paid") {
        await execute("UPDATE orders SET payment_status = 'paid' WHERE id = ?", [id]);
      }

      // Reduce stock + award loyalty points when order is received
      if (body.status === "received") {
        const orderItems = await query<RowDataPacket[]>("SELECT product_id, quantity FROM order_items WHERE order_id = ?", [id]);
        for (const item of orderItems) {
          if (item.product_id) {
            await execute(
              "UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?",
              [item.quantity, item.product_id]
            );
          }
        }

        // Award loyalty points
        if (order.customer_id) {
          try {
            // Get points_per_taka setting
            const settingsRows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'points_per_taka'");
            const pointsPerTaka = settingsRows.length > 0 ? Number(JSON.parse(settingsRows[0].value as string)) : 10;

            // Get customer's current points to determine tier multiplier
            const balanceRows = await query<RowDataPacket[]>("SELECT COALESCE(SUM(points), 0) as total FROM customer_points WHERE customer_id = ?", [order.customer_id]);
            const currentPoints = Number(balanceRows[0]?.total) || 0;

            const tierRows = await query<RowDataPacket[]>(
              "SELECT points_multiplier FROM membership_tiers WHERE is_active = 1 AND min_points <= ? AND max_points >= ? LIMIT 1",
              [currentPoints, currentPoints]
            );
            const multiplier = tierRows.length > 0 ? Number(tierRows[0].points_multiplier) : 1;

            const orderTotal = Number(order.total) || 0;
            const basePoints = Math.floor(orderTotal / pointsPerTaka);
            const earnedPoints = Math.floor(basePoints * multiplier);

            if (earnedPoints > 0) {
              const pointsId = `pts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              await execute(
                "INSERT INTO customer_points (id, customer_id, points, type, reference_id, description) VALUES (?, ?, ?, 'purchase', ?, ?)",
                [pointsId, order.customer_id, earnedPoints, id, `Earned from order ${order.order_number} (${multiplier}x multiplier)`]
              );
              // Notify customer about points earned
              const pNotifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              await execute(
                "INSERT INTO customer_notifications (id, customer_id, type, title, message) VALUES (?, ?, 'loyalty', ?, ?)",
                [pNotifId, order.customer_id, `You earned ${earnedPoints} points!`, `Your purchase from order ${order.order_number} earned you ${earnedPoints} loyalty points.`]
              ).catch(() => {});
            }

            // Update customer total_spent and total_orders
            await execute(
              "UPDATE customers SET total_spent = total_spent + ?, total_orders = total_orders + 1, last_order_at = NOW() WHERE id = ?",
              [orderTotal, order.customer_id]
            );
          } catch {
            // Don't fail the order status update if points fail
          }
        }
      }

      // Non-COD (bKash, Nagad, Card, etc.): payment becomes 'paid' when order is confirmed
      if (body.status === "confirmed" && !isCOD && order.payment_status !== "paid") {
        await execute("UPDATE orders SET payment_status = 'paid' WHERE id = ?", [id]);
      }

      // Not Received: auto-flag customer as fraud
      if (body.status === "not_received") {
        const fraudId = `fraud-${Date.now()}`;
        const riskFactors = JSON.stringify(["Order not received by customer", "Potential fraudulent claim"]);
        await execute(
          `INSERT INTO fraud_alerts (id, order_id, order_number, customer_id, customer_name, customer_phone, amount, risk_score, risk_factors, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'flagged')`,
          [fraudId, id, order.order_number, order.customer_id || null, order.customer_name, order.customer_phone, order.total, 85, riskFactors]
        );
        await logActivity(`Fraud alert created — order not received`, "fraud", fraudId, `Order ${order.order_number}`);
      }
    }
    if (body.payment_status) await execute("UPDATE orders SET payment_status = ? WHERE id = ?", [body.payment_status, id]);
    if (body.notes !== undefined) await execute("UPDATE orders SET notes = ? WHERE id = ?", [body.notes, id]);
    if (body.status) await logActivity(`Updated order status to ${body.status}`, "order", id, `Order ${id}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await execute("DELETE FROM orders WHERE id = ?", [id]); return NextResponse.json({ success: true }); }
  catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 }); }
}
