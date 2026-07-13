import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import bcrypt from "bcryptjs";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { validate, validationError, publicServerError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";

/** True only when the request carries a cookie for a currently-superadmin
 * account — the client-side "canEditCustomer" check in the admin panel is
 * just a UI convenience, not a security boundary, since a direct API call
 * bypasses any client check entirely. */
async function isSuperadmin(req: NextRequest): Promise<boolean> {
  const adminId = req.cookies.get("chinexa-admin-id")?.value;
  if (!adminId) return false;
  const rows = await query<RowDataPacket[]>("SELECT role FROM admin_users WHERE id = ?", [adminId]);
  return rows.length > 0 && rows[0].role === "superadmin";
}

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
    return publicServerError("GET /api/customers/[id]", error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Used by both the customer's own profile page and the admin customer
    // editor — previously neither name, email, nor phone was validated at
    // all here, so either could blank the name or save a malformed email/
    // phone straight to the DB.
    if (body.name !== undefined) {
      const err = validate([{ field: "name", value: body.name, rules: ["required", "string", { maxLength: 100 }], label: "Name" }]);
      if (err) return validationError(err);
    }
    if (body.email !== undefined && body.email) {
      const err = validate([{ field: "email", value: body.email, rules: ["email"], label: "Email" }]);
      if (err) return validationError(err);
    }
    if (body.phone !== undefined) {
      const err = validate([{ field: "phone", value: body.phone, rules: ["required", "phone"], label: "Phone" }]);
      if (err) return validationError(err);
    }

    // Admin-initiated password reset — a superadmin setting a NEW password
    // for someone else's account. Distinct from the customer's own
    // self-service change_password/reset_password (in /api/auth), which
    // prove identity via the current password or a verified OTP; here the
    // proof of authority is instead "you are logged in as a superadmin."
    if (body.new_password !== undefined) {
      // Password reset stays superadmin-only regardless of granted
      // customers permissions — a separately-reasoned, deliberately
      // superadmin-exclusive capability, not something a regular admin
      // should ever be grantable.
      if (!(await isSuperadmin(req))) {
        return NextResponse.json({ error: "Only a super admin can reset a customer's password" }, { status: 403 });
      }
      if (typeof body.new_password !== "string" || body.new_password.length < 6) {
        return validationError("Password must be at least 6 characters");
      }
      if (body.new_password.length > 128) {
        return validationError("Password must be at most 128 characters");
      }
    } else if (req.cookies.get("chinexa-admin-id")?.value) {
      // This route is also called by the customer's own self-service profile
      // page (no admin cookie present) — only gate on the admin permission
      // when the request is actually coming from the admin panel.
      const denied = await requirePermission(req, "customers", "edit");
      if (denied) return denied;
    }

    const fields: string[] = []; const values: (string | number | null)[] = [];
    for (const [k, col] of Object.entries({ name: "name", email: "email", phone: "phone", birthdate: "birthdate", avatar: "avatar" })) {
      if (body[k] !== undefined) { fields.push(`${col} = ?`); values.push(body[k]); }
    }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); values.push(body.is_active ? 1 : 0); }
    if (body.new_password !== undefined) {
      fields.push("password = ?");
      values.push(await bcrypt.hash(body.new_password, 10));
      fields.push("account_type = ?");
      values.push("registered");
    }
    if (fields.length > 0) { values.push(id); await execute(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`, values); }
    await logActivity(
      body.new_password !== undefined ? "Reset customer password" : "Updated customer",
      "customer", id
    );
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("PUT /api/customers/[id]", error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";

    if (hard) {
      // Hard delete — permanently removes the row. This is meaningfully more
      // dangerous than soft-delete (also reachable here, unauthenticated, as
      // the customer's own self-service "delete my account" action) so it's
      // restricted to a superadmin, checked server-side since the admin
      // panel's own button-visibility check is not a security boundary.
      if (!(await isSuperadmin(req))) {
        return NextResponse.json({ error: "Only a super admin can permanently delete a customer" }, { status: 403 });
      }
      await execute("DELETE FROM customers WHERE id = ?", [id]);
    } else {
      // Soft delete — deactivate the account. Also reachable unauthenticated
      // as the customer's own self-service "delete my account" action, so
      // only gate this on the admin permission when the request is actually
      // coming from the admin panel (carries the admin cookie).
      if (req.cookies.get("chinexa-admin-id")?.value) {
        const denied = await requirePermission(req, "customers", "delete");
        if (denied) return denied;
      }
      await execute(
        "UPDATE customers SET is_active = FALSE, deactivated_at = NOW(), deactivation_reason = 'Customer requested account deletion' WHERE id = ?",
        [id]
      );
    }
    await logActivity("Deactivated customer", "customer", id, hard ? "Hard delete" : "Soft delete");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return publicServerError("DELETE /api/customers/[id]", error);
  }
}
