import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { notifyTierUpgrade, notifyAdmin } from "@/lib/notify";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { insertCustomerPoints } from "@/lib/points";
import { publicServerError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

// ─── Helper: restore stock for an order's items ───
async function restoreStock(conn: import("mysql2/promise").PoolConnection, orderId: string) {
  const [items] = await conn.execute<RowDataPacket[]>(
    "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?", [orderId]
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
}

// ─── Helper: deduct stock for an order's items ───
async function deductStock(conn: import("mysql2/promise").PoolConnection, orderId: string) {
  const [items] = await conn.execute<RowDataPacket[]>(
    "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?", [orderId]
  );
  for (const item of items) {
    if (item.product_id) {
      if (item.variant_id) {
        await conn.execute(
          "UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ?",
          [item.quantity, item.variant_id]
        );
      }
      await conn.execute(
        "UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?",
        [item.quantity, item.product_id]
      );
    }
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orders = await query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1", [id, id]);
    if (orders.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const order = orders[0];

    // ─── Ownership check ───
    // Order numbers are sequential/guessable, and this endpoint returns full
    // customer PII (name, phone, addresses) — it must not be fetchable by
    // anyone who can guess an id. Three legitimate callers:
    //   1. Admin panel (browser sends the chinexa-admin-id cookie automatically)
    //   2. The logged-in customer's own dashboard (?customer_id=<their id>)
    //   3. The public Track Order page for guests (?phone=<the phone on the order>)
    const isAdmin = !!req.cookies.get("chinexa-admin-id")?.value;
    if (!isAdmin) {
      const { searchParams } = new URL(req.url);
      const requestCustomerId = searchParams.get("customer_id");
      const requestPhone = searchParams.get("phone");
      const ownsBySelf = !!requestCustomerId && requestCustomerId === order.customer_id;
      const ownsByPhone = !!requestPhone && order.customer_phone
        && normalizePhone(requestPhone) === normalizePhone(order.customer_phone as string);
      if (!ownsBySelf && !ownsByPhone) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const [items, addresses, timeline] = await Promise.all([
      query<RowDataPacket[]>("SELECT * FROM order_items WHERE order_id = ?", [order.id]),
      query<RowDataPacket[]>("SELECT * FROM order_addresses WHERE order_id = ?", [order.id]),
      query<RowDataPacket[]>("SELECT * FROM order_timeline WHERE order_id = ? ORDER BY created_at", [order.id]),
    ]);
    return NextResponse.json({
      ...order,
      // mysql2 returns DECIMAL as string — normalize money fields for the frontend
      subtotal: Number(order.subtotal) || 0,
      shipping_cost: Number(order.shipping_cost) || 0,
      discount: Number(order.discount) || 0,
      tax: Number(order.tax) || 0,
      total: Number(order.total) || 0,
      items: items.map((i) => ({ ...i, unit_price: Number(i.unit_price) || 0, total_price: Number(i.total_price) || 0 })),
      billing_address: addresses.find((a) => a.type === "billing"),
      shipping_address: addresses.find((a) => a.type === "shipping"),
      timeline,
    });
  } catch (error: unknown) {
    return publicServerError("GET /api/orders/[id]", error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAccountingTables();
    const { id: paramId } = await params;
    const body = await req.json();

    const orderRows = await query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1", [paramId, paramId]);
    if (orderRows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = orderRows[0];
    const id = order.id as string;
    const prevStatus = order.status as string;

    // Status/fulfillment changes (including cancellation) need "handle_orders";
    // a full item/pricing/address edit needs "edit" — these are deliberately
    // separate grants so an admin can be given order-fulfillment duties
    // without also being able to alter what's actually on the order. The
    // Edit Order dialog always resubmits the current status alongside any
    // item/address changes, so only require handle_orders when the status
    // is ACTUALLY changing (matches the status-change branch below), not
    // merely present in the body.
    if (body.status && body.status !== prevStatus) {
      const denied = await requirePermission(req, "orders", "handle_orders");
      if (denied) return denied;
    }
    if (Array.isArray(body.items)) {
      const denied = await requirePermission(req, "orders", "edit");
      if (denied) return denied;
    }
    if (!Array.isArray(body.items) && (body.payment_status !== undefined || body.notes !== undefined)) {
      const denied = await requirePermission(req, "orders", "edit");
      if (denied) return denied;
    }

    if (body.status && body.status !== prevStatus) {
      const newStatus = body.status as string;
      const paymentMethod = (order.payment_method as string || "").toLowerCase();
      const isCOD = paymentMethod === "cod";
      const stockDeducted = Boolean(order.stock_deducted);
      const revenueCounted = Boolean(order.revenue_counted);
      const orderTotal = Number(order.total) || 0;

      // ─── All stock/financial operations in a single transaction ───
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Update status
        await conn.execute("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [newStatus, id]);

        // ─── CANCELLED: restore stock + decrement coupon ───
        if (newStatus === "cancelled") {
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
        }

        // ─── NOT_RECEIVED: restore stock + fraud alert ───
        if (newStatus === "not_received") {
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
        }

        // ─── RETURNED (via direct status change, not return-approval flow): restore stock ───
        if (newStatus === "returned") {
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
        }

        // ─── CONFIRMED: if stock was restored (e.g. re-confirming after cancel), deduct again ───
        if (newStatus === "confirmed") {
          if (!stockDeducted) {
            await deductStock(conn, id);
            await conn.execute("UPDATE orders SET stock_deducted = TRUE WHERE id = ?", [id]);
          }
          // Non-COD: mark payment as paid on confirmation
          if (!isCOD && order.payment_status !== "paid") {
            await conn.execute("UPDATE orders SET payment_status = 'paid' WHERE id = ?", [id]);
          }
        }

        // ─── RECEIVED: mark payment paid (COD), count revenue, award loyalty ───
        if (newStatus === "received") {
          if (isCOD && order.payment_status !== "paid") {
            await conn.execute("UPDATE orders SET payment_status = 'paid' WHERE id = ?", [id]);
          }
          // Ensure stock is deducted (safety net for legacy orders)
          if (!stockDeducted) {
            await deductStock(conn, id);
            await conn.execute("UPDATE orders SET stock_deducted = TRUE WHERE id = ?", [id]);
          }
          // Count revenue only once
          if (!revenueCounted && order.customer_id) {
            await conn.execute(
              "UPDATE customers SET total_spent = total_spent + ?, total_orders = total_orders + 1, last_order_at = NOW() WHERE id = ?",
              [orderTotal, order.customer_id]
            );
            await conn.execute("UPDATE orders SET revenue_counted = TRUE WHERE id = ?", [id]);
          }
        }

        await conn.commit();
        conn.release();
      } catch (txError) {
        await conn.rollback().catch(() => {});
        conn.release();
        throw txError;
      }

      // ─── Non-transactional side effects ───

      // Timeline
      await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, ?, ?)",
        [id, newStatus, body.note || `Status changed to ${newStatus}`]);

      // Customer notification
      if (order.customer_id) {
        const notifMessages: Record<string, { title: string; message: string; type: string }> = {
          confirmed: { title: "Order Confirmed", message: `Your order ${order.order_number} has been confirmed and is being prepared.`, type: "order" },
          processing: { title: "Order Processing", message: `Your order ${order.order_number} is being processed.`, type: "order" },
          shipped: { title: "Order Shipped!", message: `Your order ${order.order_number} has been shipped and is on its way.`, type: "order" },
          on_delivery: { title: "Out for Delivery", message: `Your order ${order.order_number} is out for delivery. It will arrive soon!`, type: "order" },
          received: { title: "Order Delivered", message: `Your order ${order.order_number} has been delivered. Enjoy your purchase!`, type: "order" },
          not_received: { title: "Delivery Issue", message: `There was an issue with the delivery of order ${order.order_number}. Please contact support.`, type: "order" },
          cancelled: { title: "Order Cancelled", message: `Your order ${order.order_number} has been cancelled. If you were charged, a refund will be processed.`, type: "order" },
          returned: { title: "Return Processed", message: `Your return for order ${order.order_number} has been processed. Refund will be issued shortly.`, type: "order" },
        };
        const notif = notifMessages[newStatus];
        if (notif) {
          const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          await execute(
            "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)",
            [notifId, order.customer_id, notif.type, notif.title, notif.message, `/dashboard/orders/${order.order_number}`]
          ).catch(() => {});
        }
      }

      // Loyalty points on received (non-critical — OK to fail independently)
      if (newStatus === "received" && !Boolean(order.revenue_counted) && order.customer_id) {
        try {
          const settingsRows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'points_per_taka'");
          const pointsPerTaka = settingsRows.length > 0 ? Number(JSON.parse(settingsRows[0].value as string)) : 10;

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
            await insertCustomerPoints({
              customerId: order.customer_id as string,
              points: earnedPoints,
              type: "purchase",
              referenceId: id,
              description: `Earned from order ${order.order_number} (${multiplier}x multiplier)`,
            });
            const pNotifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            await execute(
              "INSERT INTO customer_notifications (id, customer_id, type, title, message) VALUES (?, ?, 'loyalty', ?, ?)",
              [pNotifId, order.customer_id, `You earned ${earnedPoints} points!`, `Your purchase from order ${order.order_number} earned you ${earnedPoints} loyalty points.`]
            ).catch(() => {});
            // Congratulate the customer if these points pushed them into a higher tier
            await notifyTierUpgrade(order.customer_id as string, currentPoints, currentPoints + earnedPoints).catch(() => {});
          }
        } catch {
          // Don't fail the status update if points fail
        }
      }

      // Fraud alert on not_received
      if (newStatus === "not_received") {
        const fraudId = `fraud-${Date.now()}`;
        const riskFactors = JSON.stringify(["Order not received by customer", "Potential fraudulent claim"]);
        await execute(
          `INSERT INTO fraud_alerts (id, order_id, order_number, customer_id, customer_name, customer_phone, amount, risk_score, risk_factors, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'flagged')`,
          [fraudId, id, order.order_number, order.customer_id || null, order.customer_name, order.customer_phone, order.total, 85, riskFactors]
        );
        await logActivity(`Fraud alert created — order not received`, "fraud", fraudId, `Order ${order.order_number}`);
        await notifyAdmin(
          "fraud",
          `Fraud alert: ${order.order_number}`,
          `${order.customer_name} (${order.customer_phone}) claims order not received — ৳${Number(order.total).toLocaleString("en-BD")} flagged for review.`,
          "/admin/fraud"
        );
      }

      await logActivity(`Updated order status to ${newStatus}`, "order", id, `Order ${order.order_number}`);
    }

    // Direct field updates (no status change)
    if (body.payment_status) await execute("UPDATE orders SET payment_status = ? WHERE id = ?", [body.payment_status, id]);
    if (body.notes !== undefined) await execute("UPDATE orders SET notes = ? WHERE id = ?", [body.notes, id]);

    // ─── Full order edit: items/quantities/prices/discount/shipping/address (requires orders:edit — enforced above) ───
    if (Array.isArray(body.items)) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Re-read inside the transaction in case status changed above
        const [freshRows] = await conn.execute<RowDataPacket[]>("SELECT * FROM orders WHERE id = ?", [id]);
        const freshOrder = freshRows[0];
        const stockDeducted = Boolean(freshOrder.stock_deducted);

        const [oldItemRows] = await conn.execute<RowDataPacket[]>(
          "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?", [id]
        );

        // Adjust stock by the delta between old and new quantities, keyed by
        // product+variant — only if this order has actually deducted stock
        // (unconfirmed/pending orders never held stock in the first place).
        if (stockDeducted) {
          const key = (productId: unknown, variantId: unknown) => `${productId || ""}:${variantId || ""}`;
          const oldQty = new Map<string, number>();
          for (const item of oldItemRows) {
            const k = key(item.product_id, item.variant_id);
            oldQty.set(k, (oldQty.get(k) || 0) + Number(item.quantity));
          }
          const newQty = new Map<string, number>();
          for (const item of body.items as Record<string, unknown>[]) {
            const k = key(item.product_id, item.variant_id);
            newQty.set(k, (newQty.get(k) || 0) + Number(item.quantity));
          }
          const allKeys = new Set([...oldQty.keys(), ...newQty.keys()]);
          for (const k of allKeys) {
            const [productId, variantId] = k.split(":");
            const delta = (newQty.get(k) || 0) - (oldQty.get(k) || 0);
            if (delta === 0 || !productId) continue;
            // delta > 0 means more was ordered -> deduct extra stock; delta < 0 -> restore
            if (variantId) {
              await conn.execute("UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ?", [delta, variantId]);
            }
            await conn.execute("UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?", [delta, productId]);
          }
        }

        // Resolve cost_price per product (+ variant adjustment) for the new
        // line items so an admin-edited order still carries an accurate COGS
        // snapshot — a plain batch read is fine here since this is an admin
        // correction path, not a customer-facing stock race.
        const newProductIds = [...new Set((body.items as Record<string, unknown>[]).map((i) => i.product_id as string).filter(Boolean))];
        const costByProductId = new Map<string, number>();
        const costAdjustmentByVariantId = new Map<string, number>();
        if (newProductIds.length > 0) {
          const placeholders = newProductIds.map(() => "?").join(",");
          const [costRows] = await conn.execute<RowDataPacket[]>(
            `SELECT id, cost_price FROM products WHERE id IN (${placeholders})`, newProductIds
          );
          for (const row of costRows) costByProductId.set(row.id as string, Number(row.cost_price) || 0);
          const newVariantIds = [...new Set((body.items as Record<string, unknown>[]).map((i) => i.variant_id as string).filter(Boolean))];
          if (newVariantIds.length > 0) {
            const vPlaceholders = newVariantIds.map(() => "?").join(",");
            const [variantRows] = await conn.execute<RowDataPacket[]>(
              `SELECT id, cost_price_adjustment FROM product_variants WHERE id IN (${vPlaceholders})`, newVariantIds
            );
            for (const row of variantRows) costAdjustmentByVariantId.set(row.id as string, Number(row.cost_price_adjustment) || 0);
          }
        }

        // Replace line items
        await conn.execute("DELETE FROM order_items WHERE order_id = ?", [id]);
        let subtotal = 0;
        for (const item of body.items as Record<string, unknown>[]) {
          const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
          const unitPrice = Math.max(0, Number(item.unit_price) || 0);
          const totalPrice = quantity * unitPrice;
          subtotal += totalPrice;
          const productId = (item.product_id as string) || null;
          const variantId = (item.variant_id as string) || null;
          const costSnapshot = (productId ? costByProductId.get(productId) || 0 : 0) + (variantId ? costAdjustmentByVariantId.get(variantId) || 0 : 0);
          await conn.execute(
            "INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, product_image, product_slug, variant, quantity, unit_price, total_price, cost_price_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              `oi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, id,
              productId, variantId,
              (item.product_name as string) || "Item", (item.product_image as string) || null,
              (item.product_slug as string) || null, (item.variant as string) || null,
              quantity, unitPrice, totalPrice, costSnapshot,
            ] as (string | number | null)[]
          );
        }

        // Recalculate totals server-side — never trust a client-sent total
        const shippingCost = Math.max(0, Number(body.shipping_cost) || 0);
        const discount = Math.max(0, Number(body.discount) || 0);
        const tax = Math.max(0, Number(body.tax) || 0);
        const total = Math.max(0, subtotal - discount + shippingCost + tax);

        await conn.execute(
          "UPDATE orders SET subtotal = ?, shipping_cost = ?, discount = ?, tax = ?, total = ?, updated_at = NOW() WHERE id = ?",
          [subtotal, shippingCost, discount, tax, total, id]
        );

        // Optional shipping address update
        if (body.shipping_address) {
          const a = body.shipping_address as Record<string, unknown>;
          const [existingShip] = await conn.execute<RowDataPacket[]>(
            "SELECT id FROM order_addresses WHERE order_id = ? AND type = 'shipping' LIMIT 1", [id]
          );
          if (existingShip.length > 0) {
            await conn.execute(
              "UPDATE order_addresses SET name = ?, phone = ?, address_line_1 = ?, address_line_2 = ?, city = ?, district = ?, division = ?, postal_code = ? WHERE id = ?",
              [
                (a.name as string) || "", (a.phone as string) || "", (a.address_line_1 as string) || "",
                (a.address_line_2 as string) || null, (a.city as string) || null, (a.district as string) || null,
                (a.division as string) || null, (a.postal_code as string) || null, existingShip[0].id,
              ] as (string | number | null)[]
            );
          } else {
            await conn.execute(
              "INSERT INTO order_addresses (id, order_id, type, name, phone, address_line_1, address_line_2, city, district, division, postal_code) VALUES (?, ?, 'shipping', ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                `oaddr-${Date.now()}`, id,
                (a.name as string) || "", (a.phone as string) || "", (a.address_line_1 as string) || "",
                (a.address_line_2 as string) || null, (a.city as string) || null, (a.district as string) || null,
                (a.division as string) || null, (a.postal_code as string) || null,
              ] as (string | number | null)[]
            );
          }
        }

        await conn.commit();
        conn.release();
      } catch (txError) {
        await conn.rollback().catch(() => {});
        conn.release();
        throw txError;
      }

      await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, ?, ?)",
        [id, order.status as string, "Order details edited by admin"]);
      await logActivity("Edited order items/pricing", "order", id, `Order ${order.order_number}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("PUT /api/orders/[id]", error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const orderRows = await query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1", [id, id]);
    if (orderRows.length === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = orderRows[0];
    const orderId = order.id as string;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Restore stock if it was deducted
      if (order.stock_deducted) {
        const [items] = await conn.execute<RowDataPacket[]>(
          "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?", [orderId]
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
      }

      // Reverse customer stats if revenue was counted
      if (order.revenue_counted && order.customer_id) {
        const orderTotal = Number(order.total) || 0;
        await conn.execute(
          "UPDATE customers SET total_spent = GREATEST(total_spent - ?, 0), total_orders = GREATEST(total_orders - 1, 0) WHERE id = ?",
          [orderTotal, order.customer_id]
        );
      }

      // Decrement coupon usage
      if (order.coupon_code) {
        await conn.execute("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?", [order.coupon_code]);
      }

      await conn.execute("DELETE FROM orders WHERE id = ?", [orderId]);

      await conn.commit();
      conn.release();
    } catch (txError) {
      await conn.rollback().catch(() => {});
      conn.release();
      throw txError;
    }

    await logActivity("Order deleted", "order", orderId, `Order ${order.order_number}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("DELETE /api/orders/[id]", error);
  }
}
