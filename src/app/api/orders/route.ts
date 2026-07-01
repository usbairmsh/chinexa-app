import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute, escapeLike } from "@/lib/db";
import { validate, validationError } from "@/lib/validate";

interface OrderRow extends RowDataPacket { [key: string]: unknown; }

// Normalize Bangladesh phone: "01712345678" → "+88017..." and vice versa
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("page_size")) || 20;
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (status) { where += " AND status = ?"; params.push(status); }
    if (search) { where += " AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)"; const q = `%${escapeLike(search)}%`; params.push(q, q, q); }

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM orders ${where}`, params);
    const total = (countRows[0] as { total: number })?.total || 0;

    const safeLimit = Math.max(1, Math.min(Math.floor(pageSize), 100));
    const safeOffset = Math.max(0, Math.floor((page - 1) * safeLimit));
    const orders = await query<OrderRow[]>(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`, params);

    return NextResponse.json({ data: orders.map((o) => ({ ...o, is_active: undefined })), total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const err = validate([
      { field: "customer_name", value: body.customer_name, rules: ["required", "string"], label: "Customer name" },
      { field: "customer_phone", value: body.customer_phone, rules: ["required", "string"], label: "Customer phone" },
      { field: "total", value: Number(body.total), rules: ["required", "number", "positive"], label: "Order total" },
    ]);
    if (err) return validationError(err);
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return validationError("Order must contain at least one item");
    }
    for (const item of body.items) {
      if (!item.product_name || !item.quantity || item.quantity < 1) {
        return validationError("Each order item must have a product name and quantity of at least 1");
      }
    }
    const id = `ord-${Date.now()}`;
    const orderNumber = `ORD-${String(Date.now()).slice(-6)}`;

    // Auto-create or find customer by phone number
    let customerId = body.customer_id || null;
    const phone = (body.customer_phone || "").trim();
    const name = (body.customer_name || "").trim();

    if (phone && !customerId) {
      const normalizedPhone = normalizePhone(phone);
      const existing = await query<RowDataPacket[]>("SELECT id FROM customers WHERE phone = ? OR phone = ? LIMIT 1", [phone, normalizedPhone]);
      if (existing.length > 0) {
        customerId = existing[0].id;
      } else if (name) {
        // Auto-create customer profile from checkout info
        customerId = `cust-${Date.now()}`;
        await execute(
          "INSERT INTO customers (id, name, email, phone, is_active) VALUES (?, ?, ?, ?, TRUE)",
          [customerId, name, body.billing_address?.email || null, normalizedPhone]
        );
        // Save billing address as default address
        if (body.billing_address?.address_line_1) {
          const a = body.billing_address;
          await execute(
            "INSERT INTO customer_addresses (id, customer_id, label, name, phone, address_line_1, address_line_2, city, district, division, postal_code, is_default) VALUES (?, ?, 'Home', ?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
            [`addr-${customerId}`, customerId, name, phone, a.address_line_1, a.address_line_2 || null, a.city || null, a.district || null, a.division || null, a.postal_code || null]
          );
        }
      }
    }

    // Update customer stats
    if (customerId) {
      await execute(
        "UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ?, last_order_at = NOW() WHERE id = ?",
        [body.total || 0, customerId]
      );
    }

    await execute(
      `INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, subtotal, shipping_cost, discount, tax, total, status, payment_method, payment_status, transaction_id, coupon_code, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orderNumber, customerId, body.customer_name, body.customer_phone, body.subtotal || 0, body.shipping_cost || 0, body.discount || 0, body.tax || 0, body.total || 0, body.status || "pending", body.payment_method || "COD", body.payment_status || "pending", body.transaction_id || null, body.coupon_code || null, body.notes || null]
    );

    // Order items
    if (body.items?.length) {
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        await execute(
          "INSERT INTO order_items (id, order_id, product_id, product_name, product_image, product_slug, variant, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [`oi-${id}-${i}`, id, item.product_id || null, item.product_name, item.product_image || null, item.product_slug || null, item.variant || null, item.quantity, item.unit_price, item.total_price || item.unit_price * item.quantity]
        );
      }
    }

    // Addresses
    if (body.billing_address) {
      const a = body.billing_address;
      await execute("INSERT INTO order_addresses (id, order_id, type, name, phone, email, address_line_1, address_line_2, city, district, division, postal_code) VALUES (?, ?, 'billing', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [`oa-b-${id}`, id, a.name, a.phone, a.email || null, a.address_line_1, a.address_line_2 || null, a.city || null, a.district || null, a.division || null, a.postal_code || null]);
    }
    if (body.shipping_address) {
      const a = body.shipping_address;
      await execute("INSERT INTO order_addresses (id, order_id, type, name, phone, email, address_line_1, address_line_2, city, district, division, postal_code) VALUES (?, ?, 'shipping', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [`oa-s-${id}`, id, a.name, a.phone, a.email || null, a.address_line_1, a.address_line_2 || null, a.city || null, a.district || null, a.division || null, a.postal_code || null]);
    }

    // Timeline
    await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'pending', 'Order placed')", [id]);

    // Increment coupon usage count
    if (body.coupon_code) {
      await execute("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?", [body.coupon_code]);
    }

    return NextResponse.json({ success: true, id, order_number: orderNumber }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
