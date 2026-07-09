import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensurePromotionColumns();
    const { id } = await params;
    // None of these three depend on each other's results — only the 404 check
    // below depends on `customers`' content — so all run as one round-trip.
    const [customers, addresses, orders] = await Promise.all([
      query<RowDataPacket[]>(
        "SELECT id, name, email, phone, birthdate, account_type, avatar, total_orders, total_spent, is_active, deactivated_at, deactivation_reason, created_at, updated_at, last_order_at FROM customers WHERE id = ? LIMIT 1",
        [id]
      ),
      query<RowDataPacket[]>("SELECT * FROM customer_addresses WHERE customer_id = ?", [id]),
      query<RowDataPacket[]>("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC", [id]),
    ]);
    if (customers.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Fetch order items with product details for each order
    const orderIds = orders.map((o) => o.id as string);
    let orderItemsMap = new Map<string, RowDataPacket[]>();
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => "?").join(",");
      const items = await query<RowDataPacket[]>(
        `SELECT oi.order_id, oi.quantity, oi.unit_price as price, oi.product_name as name, COALESCE(oi.product_image, '') as image FROM order_items oi WHERE oi.order_id IN (${placeholders})`,
        orderIds
      );
      for (const item of items) {
        const key = item.order_id as string;
        if (!orderItemsMap.has(key)) orderItemsMap.set(key, []);
        orderItemsMap.get(key)!.push(item);
      }
    }

    const ordersWithItems = orders.map((o) => ({
      ...o,
      items: (orderItemsMap.get(o.id as string) || []).map((i) => ({
        name: i.name || "Unknown Product",
        image: i.image || "",
        qty: Number(i.quantity),
        price: Number(i.price),
      })),
    }));

    return NextResponse.json({
      ...customers[0],
      is_active: !!customers[0].is_active,
      total_spent: Number(customers[0].total_spent) || 0,
      total_orders: Number(customers[0].total_orders) || 0,
      addresses,
      orders: ordersWithItems.map((o) => {
        const row = o as Record<string, unknown>;
        return { ...o, total: Number(row.total) || 0, subtotal: Number(row.subtotal) || 0 };
      }),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const fields: string[] = []; const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ name: "name", email: "email", phone: "phone", birthdate: "birthdate", avatar: "avatar" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (fields.length > 0) { values.push(id); await execute(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`, values); }
    await logActivity("Updated customer", "customer", id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";

    if (hard) {
      // Hard delete (admin only)
      await execute("DELETE FROM customers WHERE id = ?", [id]);
    } else {
      // Soft delete — deactivate the account
      await execute(
        "UPDATE customers SET is_active = FALSE, deactivated_at = NOW(), deactivation_reason = 'Customer requested account deletion' WHERE id = ?",
        [id]
      );
    }
    await logActivity("Deactivated customer", "customer", id, hard ? "Hard delete" : "Soft delete");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
