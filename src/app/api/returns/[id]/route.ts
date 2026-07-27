import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { insertCustomerPoints } from "@/lib/points";
import { checkInstantReturnAbuseRules } from "@/lib/points-deduction-engine";
import { requirePermission } from "@/lib/admin-permissions-server";
import { ensureReturnColumns } from "@/lib/migrate-returns";

// Allowed transitions. A return follows: requested → approved → pickup_scheduled
// → received → (refund track | exchange track). rejected is terminal from
// requested/approved. `apply_reversals` is a separate action (not a status).
const TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "rejected"],
  approved: ["pickup_scheduled", "received", "rejected"],
  pickup_scheduled: ["received"],
  received: ["refund_in_progress", "exchange_in_progress"],
  refund_in_progress: ["refunded"],
  exchange_in_progress: ["exchange_shipped"],
  exchange_shipped: ["exchange_delivered"],
  refunded: [],
  rejected: [],
  exchange_delivered: [],
};

const REFUND_STATUSES = new Set(["refund_in_progress", "refunded"]);
const EXCHANGE_STATUSES = new Set(["exchange_in_progress", "exchange_shipped", "exchange_delivered"]);

type ReturnItem = { product_id?: string | null; variant_id?: string | null; name?: string; qty?: number; unit_price?: number; cost_price?: number };

function parseItems(raw: unknown): ReturnItem[] {
  if (Array.isArray(raw)) return raw as ReturnItem[];
  if (typeof raw === "string") { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

async function notifyCustomer(customerId: string, title: string, message: string, orderNumber: string) {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await execute(
    "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, 'order', ?, ?, ?)",
    [notifId, customerId, title, message, `/dashboard/orders/${orderNumber}`]
  ).catch(() => {});
}

// PUT /api/returns/[id] — admin drives the return lifecycle.
//   body.status = one of the lifecycle statuses (validated against TRANSITIONS)
//   body.action = "apply_reversals" (separate financial step)
//   body.resolution = "refund" | "exchange" (set when leaving 'received')
//   body.admin_note / body.refund_amount — field updates
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureReturnColumns();
    const { id } = await params;
    const body = await req.json();

    const returns = await query<RowDataPacket[]>("SELECT * FROM order_returns WHERE id = ?", [id]);
    if (returns.length === 0) return NextResponse.json({ error: "Return not found" }, { status: 404 });
    const ret = returns[0];
    const prevStatus = ret.status as string;
    const orderNumber = ret.order_number as string;
    const customerId = ret.customer_id as string | null;
    const items = parseItems(ret.items);

    // Everything here is the return-adjacent "approve" capability.
    const denied = await requirePermission(req, "orders", "approve");
    if (denied) return denied;

    const orderRows = await query<RowDataPacket[]>("SELECT * FROM orders WHERE id = ?", [ret.order_id]);
    const order = orderRows.length > 0 ? orderRows[0] : null;

    // ─── Separate manual action: Apply Reversals ─────────────────────────────
    // Available once approved; reverses revenue + points + coupon (pro-rated to
    // the returned lines), guarded so it runs at most once.
    if (body.action === "apply_reversals") {
      if (!["approved", "pickup_scheduled", "received", "refund_in_progress", "refunded", "exchange_in_progress", "exchange_shipped", "exchange_delivered"].includes(prevStatus)) {
        return NextResponse.json({ error: "Reversals can only be applied after the return is approved." }, { status: 409 });
      }
      if (ret.reversals_applied) {
        return NextResponse.json({ error: "Reversals have already been applied for this return." }, { status: 409 });
      }
      const returnValue = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
      const orderTotal = order ? Number(order.total) || 0 : 0;
      const isWholeOrder = order ? returnValue >= orderTotal - 0.5 : false;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        // Revenue: subtract the returned value; decrement order count only when
        // the whole order is being returned.
        if (order && order.revenue_counted && order.customer_id) {
          await conn.execute(
            `UPDATE customers SET total_spent = GREATEST(total_spent - ?, 0)${isWholeOrder ? ", total_orders = GREATEST(total_orders - 1, 0)" : ""} WHERE id = ?`,
            [returnValue, order.customer_id]
          );
          if (isWholeOrder) await conn.execute("UPDATE orders SET revenue_counted = FALSE WHERE id = ?", [ret.order_id]);
        }
        // Coupon: release only when the whole order is reversed.
        if (order && order.coupon_code && isWholeOrder) {
          await conn.execute("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = ?", [order.coupon_code]);
        }
        await conn.execute("UPDATE order_returns SET reversals_applied = TRUE, updated_at = NOW() WHERE id = ?", [id]);
        await conn.commit();
        conn.release();
      } catch (txErr) {
        await conn.rollback().catch(() => {});
        conn.release();
        throw txErr;
      }

      // Loyalty points: claw back the points earned on the returned value
      // (pro-rated). Best-effort.
      if (customerId) {
        try {
          const earned = await query<RowDataPacket[]>(
            "SELECT COALESCE(SUM(points),0) AS pts FROM customer_points WHERE customer_id = ? AND reference_id = ? AND type = 'purchase'",
            [customerId, ret.order_id]
          );
          const totalEarned = Number(earned[0]?.pts) || 0;
          const proRata = isWholeOrder ? totalEarned : Math.round(totalEarned * (orderTotal > 0 ? returnValue / orderTotal : 0));
          if (proRata > 0) {
            await insertCustomerPoints({
              customerId, points: -Math.abs(proRata), type: "refund",
              referenceId: ret.order_id as string,
              description: `Points reversed for returned items — order ${orderNumber}`,
            });
          }
        } catch { /* non-critical */ }
        // Recompute tier after points/spend change — insertCustomerPoints and
        // the points-deduction engine already recompute on balance change; run
        // the abuse re-check too.
        await checkInstantReturnAbuseRules(customerId).catch(() => {});
      }

      await logActivity("Return reversals applied", "order", id, `Order ${orderNumber}`);
      return NextResponse.json({ success: true });
    }

    // ─── Status transition ───────────────────────────────────────────────────
    if (!body.status) {
      // Field-only update (admin_note / refund_amount).
      const fields: string[] = []; const values: (string | number | null)[] = [];
      if (body.admin_note !== undefined) { fields.push("admin_note = ?"); values.push(body.admin_note); }
      if (body.refund_amount !== undefined) { fields.push("refund_amount = ?"); values.push(Number(body.refund_amount)); }
      if (fields.length > 0) { fields.push("updated_at = NOW()"); values.push(id); await execute(`UPDATE order_returns SET ${fields.join(", ")} WHERE id = ?`, values); }
      return NextResponse.json({ success: true });
    }

    const newStatus = body.status as string;
    const allowed = TRANSITIONS[prevStatus] || [];
    if (newStatus !== prevStatus && !allowed.includes(newStatus)) {
      return NextResponse.json({ error: `Cannot move a return from "${prevStatus}" to "${newStatus}".` }, { status: 409 });
    }

    // Resolution must be chosen when leaving 'received'.
    const resolution: "refund" | "exchange" | null =
      REFUND_STATUSES.has(newStatus) ? "refund" : EXCHANGE_STATUSES.has(newStatus) ? "exchange" : (ret.resolution as "refund" | "exchange" | null);

    // Guards specific to certain transitions -------------------------------------------------
    // Refund requires reversals to be applied first.
    if (newStatus === "refunded" && !ret.reversals_applied) {
      return NextResponse.json({ error: "Apply financial reversals before marking the return refunded." }, { status: 409 });
    }
    // Exchange ship: block if any replacement line is out of stock.
    if (newStatus === "exchange_shipped") {
      for (const it of items) {
        if (!it.product_id) continue;
        let avail = 0;
        if (it.variant_id) {
          const v = await query<RowDataPacket[]>("SELECT stock FROM product_variants WHERE id = ?", [it.variant_id]);
          avail = Number(v[0]?.stock) || 0;
        } else {
          const p = await query<RowDataPacket[]>("SELECT stock_quantity FROM products WHERE id = ?", [it.product_id]);
          avail = Number(p[0]?.stock_quantity) || 0;
        }
        if (avail < (Number(it.qty) || 1)) {
          return NextResponse.json({ error: `Replacement out of stock for "${it.name || "an item"}". Restock or switch to refund.` }, { status: 409 });
        }
      }
    }

    // Persist the status (+ resolution + timestamps).
    {
      const fields = ["status = ?"]; const values: (string | number | null)[] = [newStatus];
      if (resolution) { fields.push("resolution = ?"); values.push(resolution); }
      if (body.admin_note !== undefined) { fields.push("admin_note = ?"); values.push(body.admin_note); }
      if (body.refund_amount !== undefined) { fields.push("refund_amount = ?"); values.push(Number(body.refund_amount)); }
      if (newStatus === "refunded") { fields.push("refunded_at = NOW()"); }
      if (newStatus === "exchange_shipped") { fields.push("exchange_shipped_at = NOW()"); }
      fields.push("updated_at = NOW()"); values.push(id);
      await execute(`UPDATE order_returns SET ${fields.join(", ")} WHERE id = ?`, values);
    }

    // ── Side effects per transition ──
    if (newStatus === "approved") {
      await execute("UPDATE orders SET status = 'returned', updated_at = NOW() WHERE id = ?", [ret.order_id]);
      await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'returned', 'Return approved by admin')", [ret.order_id]);
      if (customerId) {
        await notifyCustomer(customerId, "Return Approved", `Your return for order ${orderNumber} is approved and in progress.`, orderNumber);
        await checkInstantReturnAbuseRules(customerId).catch(() => {});
      }
    }

    if (newStatus === "rejected" && customerId) {
      await notifyCustomer(customerId, "Return Rejected", `Your return request for order ${orderNumber} was not approved.${body.admin_note ? ` ${body.admin_note}` : ""}`, orderNumber);
    }

    if (newStatus === "pickup_scheduled" && customerId) {
      await notifyCustomer(customerId, "Pickup Scheduled", `A pickup has been scheduled for your return on order ${orderNumber}.`, orderNumber);
    }

    // Received → restore stock for the RETURNED items (once, on entry).
    if (newStatus === "received") {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const it of items) {
          if (!it.product_id) continue;
          const qty = Number(it.qty) || 1;
          if (it.variant_id) await conn.execute("UPDATE product_variants SET stock = stock + ? WHERE id = ?", [qty, it.variant_id]);
          await conn.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [qty, it.product_id]);
        }
        await conn.commit();
        conn.release();
      } catch (txErr) { await conn.rollback().catch(() => {}); conn.release(); throw txErr; }
      if (customerId) await notifyCustomer(customerId, "Product Received", `We've received your returned item(s) for order ${orderNumber}. Your refund/exchange is now in progress.`, orderNumber);
    }

    if (newStatus === "refund_in_progress" && customerId) {
      await notifyCustomer(customerId, "Refund in Progress", `Your refund for order ${orderNumber} is being processed.`, orderNumber);
    }

    // Refunded → payment refunded (paid orders only) + accounting reflects it.
    // The accounting/cashflow layer counts only payment_status='paid' orders, so
    // flipping to 'refunded' removes the order from net revenue. That's correct
    // for a WHOLE-order refund; for a PARTIAL refund we must NOT flip it (that
    // would drop the entire order's revenue) — the pro-rated total_spent reversal
    // in Apply Reversals already accounts for the returned portion.
    if (newStatus === "refunded") {
      const returnValue = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
      const orderTotal = order ? Number(order.total) || 0 : 0;
      const isWholeOrder = order ? returnValue >= orderTotal - 0.5 : false;
      if (isWholeOrder) {
        await execute("UPDATE orders SET payment_status = 'refunded' WHERE id = ? AND payment_status = 'paid'", [ret.order_id]);
      }
      if (customerId) {
        const amt = Number(ret.refund_amount ?? body.refund_amount ?? 0);
        const paid = order && order.payment_status === "paid";
        await notifyCustomer(customerId, "Refund Completed", paid ? `Your refund of ৳${amt.toLocaleString("en-BD")} for order ${orderNumber} has been completed.` : `Your return for order ${orderNumber} is closed. No payment was due (COD).`, orderNumber);
      }
    }

    // Exchange track — replacement of the same items.
    if (newStatus === "exchange_in_progress" && customerId) {
      await notifyCustomer(customerId, "Exchange in Progress", `Your replacement for order ${orderNumber} is being prepared.`, orderNumber);
    }
    if (newStatus === "exchange_shipped") {
      // Deduct replacement stock (net-neutral vs the restore at 'received').
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const it of items) {
          if (!it.product_id) continue;
          const qty = Number(it.qty) || 1;
          if (it.variant_id) await conn.execute("UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ?", [qty, it.variant_id]);
          await conn.execute("UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?", [qty, it.product_id]);
        }
        await conn.commit();
        conn.release();
      } catch (txErr) { await conn.rollback().catch(() => {}); conn.release(); throw txErr; }
      if (customerId) await notifyCustomer(customerId, "Replacement Shipped", `Your replacement for order ${orderNumber} has shipped.`, orderNumber);
    }
    if (newStatus === "exchange_delivered" && customerId) {
      await notifyCustomer(customerId, "Replacement Delivered", `Your replacement for order ${orderNumber} has been delivered. Enjoy!`, orderNumber);
    }

    await logActivity(`Return ${newStatus}`, "order", id, `Order ${orderNumber}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
