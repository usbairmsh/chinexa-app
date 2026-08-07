import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validate, validationError, publicServerError } from "@/lib/validate";
import { notifyAdmin } from "@/lib/notify";
import { ensureReturnColumns } from "@/lib/migrate-returns";
import { getReturnConfig } from "@/lib/return-config";
import { checkInstantReturnAbuseRules } from "@/lib/points-deduction-engine";
import { requirePermission } from "@/lib/admin-permissions-server";
import { getVerifiedCustomerId } from "@/lib/customer-session";
import { getVerifiedAdminId } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

// GET /api/returns — list all returns (admin) or by customer_id
export async function GET(req: NextRequest) {
  try {
    await ensureReturnColumns();
    const customerId = req.nextUrl.searchParams.get("customer_id");
    const orderId = req.nextUrl.searchParams.get("order_id");
    const orderNumber = req.nextUrl.searchParams.get("order_number");

    // Public, REDACTED status lookup for the guest order-tracking page. Returns
    // only each return's status/created_at for an order number — no customer
    // name, reason, description or refund amount. This is the same trust level
    // as /api/track-order (anyone with the order number sees its status), and it
    // exists because the full owner-gated branches below correctly 403 a guest.
    const statusFor = req.nextUrl.searchParams.get("status_for");
    if (statusFor) {
      const rows = await query<RowDataPacket[]>(
        "SELECT status, resolution, created_at, updated_at FROM order_returns WHERE order_number = ? ORDER BY created_at DESC",
        [statusFor]
      );
      return NextResponse.json(
        rows.map((r) => ({ status: r.status, resolution: r.resolution, created_at: r.created_at, updated_at: r.updated_at })),
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Every branch (filtered or not) is owner-or-admin now. Previously a filter
    // param bypassed the permission check entirely, letting anyone read another
    // customer's / order's returns by guessing an id.
    const isAdmin = !!getVerifiedAdminId(req);
    const sessionId = getVerifiedCustomerId(req);

    let sql = "SELECT * FROM order_returns";
    const params: string[] = [];

    if (customerId) {
      // A signed-in customer may only read their own; admins may read any.
      if (!isAdmin) {
        if (!sessionId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
        if (String(customerId) !== sessionId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      sql += " WHERE customer_id = ?";
      params.push(customerId);
    } else if (orderId || orderNumber) {
      // Order-scoped lookup: the order must belong to the session customer
      // (admins may look up any order's returns).
      const lookup = orderId || (orderNumber as string);
      if (!isAdmin) {
        if (!sessionId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
        const ownerRows = await query<RowDataPacket[]>(
          "SELECT customer_id FROM orders WHERE id = ? OR order_number = ? LIMIT 1",
          [lookup, lookup]
        );
        const ownerId = ownerRows.length ? String(ownerRows[0].customer_id ?? "") : "";
        if (!ownerId || ownerId !== sessionId) {
          return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }
      }
      if (orderId) {
        // Accept either the internal order id or the order number.
        sql += " WHERE order_id = ? OR order_number = ?";
        params.push(orderId, orderId);
      } else {
        sql += " WHERE order_number = ?";
        params.push(orderNumber as string);
      }
    } else {
      // No filter = the admin "all returns" list — gate it.
      const denied = await requirePermission(req, "returns", "view");
      if (denied) return denied;
    }

    sql += " ORDER BY created_at DESC";

    const rows = await query<RowDataPacket[]>(sql, params);
    return NextResponse.json(rows.map((r) => ({
      ...r,
      refund_amount: r.refund_amount != null ? Number(r.refund_amount) : null,
      items: typeof r.items === "string" ? JSON.parse(r.items) : r.items || [],
    })));
  } catch (error: unknown) {
    return publicServerError("GET /api/returns", error);
  }
}

// POST /api/returns — customer requests a return
export async function POST(req: NextRequest) {
  try {
    await ensureReturnColumns();
    const isAdmin = !!getVerifiedAdminId(req);
    const sessionId = getVerifiedCustomerId(req);
    const body = await req.json();
    const err = validate([
      { field: "order_id", value: body.order_id, rules: ["required", "string"], label: "Order" },
      { field: "reason", value: body.reason, rules: ["required", "string"], label: "Reason" },
    ]);
    if (err) return validationError(err);

    // Config: reasons (validate the code) + return window (from delivery).
    const config = await getReturnConfig();
    const reasonMatch = config.reasons.find((r) => r.code === body.reason && r.enabled !== false);
    if (!reasonMatch) return validationError("Invalid return reason");
    const reasonLbl = reasonMatch.label;

    // Selected items (per-item, whole-line). Sanitize to the fields we store.
    const selectedItems = Array.isArray(body.items)
      ? body.items.map((it: Record<string, unknown>) => ({
          product_id: (it.product_id as string) || null,
          variant_id: (it.variant_id as string) || null,
          name: (it.name as string) || "Item",
          qty: Number(it.qty) || 1,
          unit_price: Number(it.unit_price) || 0,
          cost_price: Number(it.cost_price) || 0,
        }))
      : [];
    if (selectedItems.length === 0) return validationError("Select at least one item to return");

    // Images (max 2 URLs).
    const images = Array.isArray(body.images)
      ? body.images.filter((x: unknown): x is string => typeof x === "string").slice(0, 2)
      : [];

    // Refund estimate = subtotal of the selected lines.
    const refundEstimate = selectedItems.reduce((s: number, it: { qty: number; unit_price: number }) => s + it.qty * it.unit_price, 0);
    const itemKey = (p?: string | null, v?: string | null) => `${p || ""}::${v || ""}`;
    const selectedKeys = new Set(selectedItems.map((it: { product_id: string | null; variant_id: string | null }) => itemKey(it.product_id, it.variant_id)));

    const id = `ret-${Date.now()}`;
    let order: RowDataPacket;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [orders] = await conn.execute<RowDataPacket[]>("SELECT * FROM orders WHERE id = ? OR order_number = ? LIMIT 1 FOR UPDATE", [body.order_id, body.order_id]);
      if (orders.length === 0) {
        await conn.rollback(); conn.release();
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      order = orders[0];

      // Ownership: a signed-in customer may only open a return on their OWN
      // order; admins may act on any. A guessed order_id must not let one
      // customer file a return against another's order.
      if (!isAdmin) {
        const ownerId = String(order.customer_id ?? "");
        if (!sessionId || !ownerId || ownerId !== sessionId) {
          await conn.rollback(); conn.release();
          return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }
      }

      if (order.status !== "received") {
        await conn.rollback(); conn.release();
        return NextResponse.json({ error: "Returns can only be requested for delivered orders" }, { status: 400 });
      }

      // Return window — counted from the DELIVERED date (the 'received' timeline
      // entry), falling back to order date; days are admin-configurable.
      const [deliveredRows] = await conn.execute<RowDataPacket[]>(
        "SELECT created_at FROM order_timeline WHERE order_id = ? AND status = 'received' ORDER BY created_at DESC LIMIT 1", [order.id]
      );
      const deliveredAt = deliveredRows.length ? new Date(deliveredRows[0].created_at as string) : new Date(order.created_at as string);
      const daysSince = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > config.windowDays) {
        await conn.rollback(); conn.release();
        return NextResponse.json({ error: `Return window has expired. Returns must be requested within ${config.windowDays} days of delivery.` }, { status: 400 });
      }

      // Per-item duplicate guard: block only if a selected line is already in a
      // non-rejected return (allows returning OTHER items later).
      const [existingReturns] = await conn.execute<RowDataPacket[]>("SELECT items FROM order_returns WHERE order_id = ? AND status NOT IN ('rejected')", [order.id]);
      const alreadyReturned = new Set<string>();
      for (const r of existingReturns) {
        const its = typeof r.items === "string" ? JSON.parse(r.items || "[]") : (r.items || []);
        for (const it of its) alreadyReturned.add(itemKey(it.product_id, it.variant_id));
      }
      const overlap = [...selectedKeys].some((k) => alreadyReturned.has(k as string));
      if (overlap) {
        await conn.rollback(); conn.release();
        return NextResponse.json({ error: "One or more of these items already has an active return." }, { status: 409 });
      }

      await conn.execute(
        "INSERT INTO order_returns (id, order_id, order_number, customer_id, customer_name, reason, reason_label, description, images, status, refund_amount, items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)",
        [
          id, order.id, order.order_number,
          order.customer_id || null, order.customer_name,
          body.reason, reasonLbl,
          body.description ? String(body.description).slice(0, 500) : null,
          JSON.stringify(images),
          refundEstimate,
          JSON.stringify(selectedItems),
        ]
      );

      await conn.commit();
      conn.release();
    } catch (txError) {
      await conn.rollback().catch(() => {});
      conn.release();
      throw txError;
    }

    // Notify customer
    if (order.customer_id) {
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await execute(
        "INSERT INTO customer_notifications (id, customer_id, type, title, message, link) VALUES (?, ?, 'order', ?, ?, ?)",
        [notifId, order.customer_id, "Return Request Submitted", `Your return request for order ${order.order_number} has been submitted. We'll review it shortly.`, `/dashboard/orders/${order.order_number}`]
      ).catch(() => {});
    }

    await logActivity("Return requested", "order", id, `Order ${order.order_number}`);

    // Abuse detection at request time — flag suspicious return patterns for the
    // admin BEFORE they approve (in addition to the on-approve check).
    if (order.customer_id) {
      await checkInstantReturnAbuseRules(order.customer_id as string).catch(() => {});
    }

    // Notify admin about the incoming return request
    await notifyAdmin(
      "return",
      `Return requested — ${order.order_number}`,
      `${order.customer_name} requested a return (${reasonLbl})${body.description ? `: ${String(body.description).slice(0, 100)}` : ""}`,
      `/admin/returns`
    );

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: unknown) {
    return publicServerError("POST /api/returns", error);
  }
}
