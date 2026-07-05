import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute, escapeLike } from "@/lib/db";
import { type RowDataPacket as StockRow } from "mysql2/promise";
import { validate, validationError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";

interface OrderRow extends RowDataPacket { [key: string]: unknown; }

// ─── One-time auto-migration for new columns ───
let migrated = false;
async function ensureColumns() {
  if (migrated) return;
  try {
    // Add columns only if absent (idempotent), so a transient failure retries next request.
    const cols = await query<RowDataPacket[]>(
      `SELECT table_name AS t, column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND ((table_name = 'orders' AND column_name IN ('stock_deducted','revenue_counted'))
           OR (table_name = 'order_items' AND column_name = 'variant_id'))`
    );
    const has = new Set(cols.map((r) => `${r.t}.${r.c}`));
    if (!has.has("orders.stock_deducted")) await execute("ALTER TABLE orders ADD COLUMN stock_deducted BOOLEAN DEFAULT FALSE");
    if (!has.has("orders.revenue_counted")) await execute("ALTER TABLE orders ADD COLUMN revenue_counted BOOLEAN DEFAULT FALSE");
    if (!has.has("order_items.variant_id")) await execute("ALTER TABLE order_items ADD COLUMN variant_id VARCHAR(50) AFTER product_id");
    // Backfill: existing confirmed+ orders already had stock deducted
    await execute("UPDATE orders SET stock_deducted = TRUE WHERE status IN ('confirmed','processing','shipped','on_delivery','received') AND stock_deducted = FALSE");
    // Backfill: existing received orders already had revenue counted
    await execute("UPDATE orders SET revenue_counted = TRUE WHERE status = 'received' AND payment_status = 'paid' AND revenue_counted = FALSE");
    migrated = true; // latch only after everything succeeded
  } catch (err) {
    console.error("[orders ensureColumns] migration failed:", err);
  }
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("0")) return `+880${cleaned.slice(1)}`;
  return cleaned;
}

export async function GET(req: NextRequest) {
  try {
    await ensureColumns();
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

    const safeLimit = Math.max(1, Math.min(Math.floor(pageSize), 500));
    const safeOffset = Math.max(0, Math.floor((page - 1) * safeLimit));
    const orders = await query<OrderRow[]>(
      `SELECT o.*, (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o ${where} ORDER BY o.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    return NextResponse.json({
      data: orders.map((o) => ({
        ...o,
        is_active: undefined,
        // mysql2 returns DECIMAL as string — normalize money fields
        subtotal: Number(o.subtotal) || 0,
        shipping_cost: Number(o.shipping_cost) || 0,
        discount: Number(o.discount) || 0,
        tax: Number(o.tax) || 0,
        total: Number(o.total) || 0,
        item_count: Number(o.item_count) || 0,
      })),
      total, page, page_size: safeLimit, total_pages: Math.max(1, Math.ceil(total / safeLimit)),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureColumns();
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
      // Guard against NaN money values reaching the DECIMAL NOT NULL columns
      if (!Number.isFinite(Number(item.unit_price)) || Number(item.unit_price) < 0) {
        return validationError(`Invalid unit price for "${item.product_name}"`);
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
        customerId = `cust-${Date.now()}`;
        await execute(
          "INSERT INTO customers (id, name, email, phone, is_active) VALUES (?, ?, ?, ?, TRUE)",
          [customerId, name, body.billing_address?.email || null, normalizedPhone]
        );
        if (body.billing_address?.address_line_1) {
          const a = body.billing_address;
          await execute(
            "INSERT INTO customer_addresses (id, customer_id, label, name, phone, address_line_1, address_line_2, city, district, division, postal_code, is_default) VALUES (?, ?, 'Home', ?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
            [`addr-${customerId}`, customerId, name, phone, a.address_line_1, a.address_line_2 || null, a.city || null, a.district || null, a.division || null, a.postal_code || null]
          );
        }
      }
    }

    // ─── ATOMIC STOCK VALIDATION + DEDUCTION in single transaction ───
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const outOfStock: string[] = [];
      for (const item of body.items) {
        if (item.product_id) {
          if (item.variant_id) {
            const [rows] = await conn.execute<StockRow[]>(
              "SELECT pv.stock, p.name FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ? FOR UPDATE",
              [item.variant_id]
            );
            if (rows.length > 0) {
              const available = Number(rows[0].stock);
              if (available < item.quantity) {
                outOfStock.push(`${rows[0].name} (only ${available} left, you requested ${item.quantity})`);
              }
            }
          } else {
            const [rows] = await conn.execute<StockRow[]>(
              "SELECT stock_quantity, name FROM products WHERE id = ? FOR UPDATE",
              [item.product_id]
            );
            if (rows.length > 0) {
              const available = Number(rows[0].stock_quantity);
              if (available < item.quantity) {
                outOfStock.push(`${rows[0].name} (only ${available} left, you requested ${item.quantity})`);
              }
            }
          }
        }
      }

      if (outOfStock.length > 0) {
        await conn.rollback();
        conn.release();
        return NextResponse.json({
          error: "Some items are no longer available",
          out_of_stock: outOfStock,
        }, { status: 409 });
      }

      // Stock is valid — deduct now inside the same transaction
      for (const item of body.items) {
        if (item.product_id) {
          if (item.variant_id) {
            await conn.execute(
              "UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ?",
              [item.quantity, item.variant_id]
            );
          }
          // Always deduct from parent product stock_quantity
          await conn.execute(
            "UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?",
            [item.quantity, item.product_id]
          );
        }
      }

      // Create the order inside the transaction
      await conn.execute(
        `INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, subtotal, shipping_cost, discount, tax, total, status, payment_method, payment_status, transaction_id, coupon_code, stock_deducted, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
        [id, orderNumber, customerId, body.customer_name, body.customer_phone, body.subtotal || 0, body.shipping_cost || 0, body.discount || 0, body.tax || 0, body.total || 0, "pending", (body.payment_method || "COD").toUpperCase(), "pending", body.transaction_id || null, body.coupon_code || null, body.notes || null]
      );

      // Order items
      if (body.items?.length) {
        for (let i = 0; i < body.items.length; i++) {
          const item = body.items[i];
          await conn.execute(
            "INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, product_image, product_slug, variant, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [`oi-${id}-${i}`, id, item.product_id || null, item.variant_id || null, item.product_name, item.product_image || null, item.product_slug || null, item.variant || null, item.quantity, item.unit_price, item.total_price || item.unit_price * item.quantity]
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

    // Non-transactional side effects (OK to fail independently)
    if (customerId) {
      await execute("UPDATE customers SET last_order_at = NOW() WHERE id = ?", [customerId]);
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
    await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'pending', 'Order placed — stock reserved')", [id]);

    // Increment coupon usage count + mark this customer's assignment as used
    if (body.coupon_code) {
      await execute("UPDATE coupons SET used_count = used_count + 1 WHERE code = ?", [body.coupon_code]);
      if (customerId) {
        await execute(
          `UPDATE customer_coupons cc
             JOIN coupons c ON c.id = cc.coupon_id
             SET cc.is_used = TRUE, cc.used_at = NOW()
           WHERE c.code = ? AND cc.customer_id = ? AND cc.is_used = FALSE`,
          [body.coupon_code, customerId]
        ).catch(() => {});
      }
    }

    // Increment usage_count on any admin offers applied to this order
    if (Array.isArray(body.applied_offer_ids) && body.applied_offer_ids.length > 0) {
      for (const offerId of body.applied_offer_ids) {
        await execute("UPDATE offers SET usage_count = usage_count + 1 WHERE id = ?", [offerId]).catch(() => {});
      }
    }

    await logActivity("New order placed", "order", id, `${orderNumber} — ৳${body.total}`);
    return NextResponse.json({ success: true, id, order_number: orderNumber }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
