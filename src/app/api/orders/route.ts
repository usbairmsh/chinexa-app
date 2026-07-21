import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute, escapeLike } from "@/lib/db";
import { type RowDataPacket as StockRow } from "mysql2/promise";
import { validate, validationError, publicServerError } from "@/lib/validate";
import { logActivity } from "@/lib/log-activity";
import { notifyAdmin } from "@/lib/notify";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { enrichCartItems, getActiveOffers, bestOfferPerLine, validateCoupon, getCustomerTier, type PromoContext } from "@/lib/promotions";
import { ensureOrderArchiveColumns } from "@/lib/migrate-order-archive";
import { ensurePreorderColumns, preordersEnabled } from "@/lib/migrate-preorder";
import { hasPreorderBadge } from "@/lib/preorder";

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
    await ensureOrderArchiveColumns();
    await ensureAccountingTables();
    const { searchParams } = new URL(req.url);

    // Archived orders live in their own tab, entirely separate from the
    // status tabs (Pending/Confirmed/etc.) — default is "not archived" so
    // every existing caller (dashboard stats, the default order list) keeps
    // working unchanged unless it explicitly asks to see the archive.
    const archived = searchParams.get("archived") === "1";

    // Lightweight per-status counts + received/paid revenue for the admin tab
    // bar and stat cards — deliberately separate from the paginated/filtered
    // list query below, since you can't derive "how many shipped orders exist
    // in total" (or total revenue) from a filtered/paginated page.
    if (searchParams.get("count_by_status") === "1") {
      const search = searchParams.get("search");
      let cwhere = "WHERE is_archived = ?";
      const cparams: (string | number)[] = [archived ? 1 : 0];
      if (search) { cwhere += " AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)"; const q = `%${escapeLike(search)}%`; cparams.push(q, q, q); }
      const rows = await query<RowDataPacket[]>(
        `SELECT status, COUNT(*) AS count FROM orders ${cwhere} GROUP BY status`,
        cparams
      );
      const counts: Record<string, number> = {};
      let total = 0;
      for (const r of rows) { counts[r.status as string] = Number(r.count); total += Number(r.count); }

      const revenueRows = await query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(total), 0) AS revenue FROM orders ${cwhere} AND status = 'received' AND payment_status = 'paid'`,
        cparams
      );
      const revenue = Number(revenueRows[0]?.revenue) || 0;

      // Archived count shown on the tab itself regardless of which tab
      // (active/archived) is currently selected, so it's always fetched
      // alongside the counts for whichever tab search is scoped to.
      const archivedCountRows = await query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM orders WHERE is_archived = 1${search ? " AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)" : ""}`,
        search ? [`%${escapeLike(search)}%`, `%${escapeLike(search)}%`, `%${escapeLike(search)}%`] : []
      );
      const archivedCount = Number(archivedCountRows[0]?.c) || 0;

      return NextResponse.json({ counts, total, revenue, archived_count: archivedCount });
    }

    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("page_size")) || 20;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const payment = searchParams.get("payment");

    let where = "WHERE is_archived = ?";
    const params: (string | number)[] = [archived ? 1 : 0];
    if (status) { where += " AND status = ?"; params.push(status); }
    if (search) { where += " AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)"; const q = `%${escapeLike(search)}%`; params.push(q, q, q); }
    if (payment) { where += " AND payment_method = ?"; params.push(payment.toUpperCase()); }

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) as total FROM orders ${where}`, params);
    const total = (countRows[0] as { total: number })?.total || 0;

    const safeLimit = Math.max(1, Math.min(Math.floor(pageSize), 500));
    const safeOffset = Math.max(0, Math.floor((page - 1) * safeLimit));
    // Pre-aggregate item counts once via a derived table instead of a
    // correlated subquery re-evaluated per order row.
    const orders = await query<OrderRow[]>(
      `SELECT o.*, COALESCE(oi_agg.item_count, 0) AS item_count
       FROM orders o
       LEFT JOIN (SELECT order_id, SUM(quantity) AS item_count FROM order_items GROUP BY order_id) oi_agg ON oi_agg.order_id = o.id
       ${where} ORDER BY o.created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
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
    return publicServerError("GET /api/orders", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureColumns();
    await ensurePromotionColumns();
    await ensureAccountingTables();
    await ensurePreorderColumns();
    const body = await req.json();
    const err = validate([
      { field: "customer_name", value: body.customer_name, rules: ["required", "string", { maxLength: 100 }], label: "Customer name" },
      { field: "customer_phone", value: body.customer_phone, rules: ["required", "string", "phone"], label: "Customer phone" },
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
      // Quantity must be a real whole unit count — a fractional or absurdly
      // large value would otherwise reach stock deduction/order_items math.
      if (!Number.isInteger(item.quantity) || item.quantity > 1000) {
        return validationError(`Invalid quantity for "${item.product_name}"`);
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
        // Guest checkout, never went through /api/auth register — tracked as
        // "temporary" so admins can distinguish real accounts from one-off buyers.
        await execute(
          "INSERT INTO customers (id, name, email, phone, is_active, account_type) VALUES (?, ?, ?, ?, TRUE, 'temporary')",
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

    // ─── AUTHORITATIVE PRICE RE-DERIVATION ───
    // A real storefront checkout (source !== "manual") must never trust the
    // client's own unit_price/subtotal/discount/total — those are client cart
    // state and a request can be sent directly to this endpoint with any
    // numbers at all. Admin-recorded manual sales (record-sale-dialog.tsx)
    // are exempt: an admin legitimately enters a custom price for an offline
    // sale, and that path already goes through admin-only UI.
    const isManualSale = body.source === "manual";
    if (!isManualSale) {
      const rawItems = body.items.map((item: { product_id?: string; variant_id?: string | null; quantity: number }) => ({
        product_id: item.product_id || "",
        variant_id: item.variant_id || null,
        price: 0, // authoritative price is looked up below, client value is ignored
        quantity: item.quantity,
      }));
      const enriched = await enrichCartItems(rawItems);
      const enrichedByKey = new Map(enriched.map((e) => [`${e.product_id}::${e.variant_id || ""}`, e]));

      for (const item of body.items) {
        const key = `${item.product_id || ""}::${item.variant_id || ""}`;
        const real = enrichedByKey.get(key);
        // No product_id (e.g. a free-text line item) — nothing to verify against, leave as-is.
        if (!item.product_id || !real) continue;
        item.unit_price = real.price;
        item.total_price = real.price * item.quantity;
      }

      const realSubtotal = body.items.reduce((sum: number, item: { unit_price: number; quantity: number }) => sum + item.unit_price * item.quantity, 0);

      // Re-derive the offer discount the same way /api/offers/apply does.
      // The resulting offer id list REPLACES body.applied_offer_ids entirely —
      // a client claiming an offer that didn't actually match must not be able
      // to inflate that offer's usage_count for an order it had no effect on.
      let realOfferDiscount = 0;
      body.applied_offer_ids = [];
      if (customerId) {
        const [offers, tier] = await Promise.all([
          getActiveOffers(),
          getCustomerTier(customerId),
        ]);
        const ctx: PromoContext = { customerId, tierName: tier?.name ?? null, tierId: tier?.id ?? null };
        const priced = body.items.map((item: { product_id?: string; variant_id?: string | null; unit_price: number; quantity: number }) => ({
          product_id: item.product_id || "",
          variant_id: item.variant_id || null,
          price: item.unit_price,
          quantity: item.quantity,
        }));
        const enrichedForOffers = await enrichCartItems(priced);
        const offerResult = bestOfferPerLine(enrichedForOffers, offers, ctx);
        realOfferDiscount = offerResult.totalDiscount;
        body.applied_offer_ids = offerResult.appliedOfferIds;
      }

      // Re-derive the coupon discount the same way /api/coupons/validate does.
      let realCouponDiscount = 0;
      if (body.coupon_code) {
        const couponItems = body.items.map((item: { product_id?: string; variant_id?: string | null; unit_price: number; quantity: number }) => ({
          product_id: item.product_id || "",
          variant_id: item.variant_id || null,
          price: item.unit_price,
          quantity: item.quantity,
        }));
        const couponResult = await validateCoupon(body.coupon_code, customerId, couponItems, realSubtotal);
        if (!couponResult.valid) {
          return validationError(`Coupon "${body.coupon_code}" is no longer valid: ${couponResult.message}`);
        }
        realCouponDiscount = couponResult.discount;
      }

      const realDiscount = realOfferDiscount + realCouponDiscount;

      // Shipping is a separate zone/rules engine (division, express, targeted
      // free-delivery rules) that this endpoint does not re-derive — bounds-check
      // it instead: never negative, and never "free" unless the recomputed
      // subtotal actually clears the store's free-delivery threshold.
      const shippingCost = Number(body.shipping_cost) || 0;
      if (shippingCost < 0) {
        return validationError("Invalid shipping cost");
      }
      if (shippingCost === 0) {
        const settingRows = await query<RowDataPacket[]>(
          "SELECT `key`, value FROM settings WHERE `key` = 'free_delivery_threshold'"
        );
        const rawThreshold = settingRows[0]?.value;
        const freeThreshold = rawThreshold != null
          ? Number(typeof rawThreshold === "string" ? JSON.parse(rawThreshold) : rawThreshold) || 3000
          : 3000;
        // A targeted delivery_rules override (express/category/tier-specific
        // free delivery) can legitimately waive shipping below the site-wide
        // threshold — that engine isn't replicated here — so only reject the
        // extreme case where free shipping is claimed on a cart nowhere near
        // ANY plausible threshold, which no legitimate rule would grant.
        if (realSubtotal < freeThreshold * 0.5) {
          return validationError("Invalid shipping cost for this order");
        }
      }

      const realTotal = Math.max(0, realSubtotal - realDiscount + shippingCost);

      body.subtotal = realSubtotal;
      body.discount = realDiscount;
      body.total = realTotal;
    }

    // ─── ATOMIC STOCK VALIDATION + DEDUCTION in single transaction ───
    const preordersOn = await preordersEnabled();
    // Hoisted so the post-transaction timeline note can reflect pre-order state.
    let isPreorderOrder = false;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const outOfStock: string[] = [];
      const costByItemIndex = new Map<number, number>();
      // Per-line pre-order flag: a line is a pre-order when its product is out
      // of stock AND carries the `preorder` badge AND the store feature is on.
      const preorderByItemIndex = new Map<number, boolean>();

      // Batch the row-locking stock reads into two queries (variants, plain
      // products) instead of one FOR UPDATE per cart line — cuts how long the
      // transaction holds these locks under concurrent checkouts.
      const variantIndices: number[] = [];
      const plainIndices: number[] = [];
      body.items.forEach((item: { product_id?: string; variant_id?: string }, idx: number) => {
        if (!item.product_id) return;
        if (item.variant_id) variantIndices.push(idx);
        else plainIndices.push(idx);
      });

      // Pre-order eligibility keys off the PARENT product (stock_quantity 0 +
      // `preorder` badge), so read badges + parent stock for every product in
      // the cart, variant lines included. release_date snapshots onto the order.
      let expectedDate: string | null = null;
      const productIdsAll = Array.from(
        new Set(body.items.map((it: { product_id?: string }) => it.product_id).filter(Boolean) as string[])
      );
      const preorderByProductId = new Map<string, boolean>();
      if (preordersOn && productIdsAll.length > 0) {
        const ph = productIdsAll.map(() => "?").join(",");
        const [prows] = await conn.execute<StockRow[]>(
          `SELECT id, stock_quantity, badges, preorder_release_date FROM products WHERE id IN (${ph})`,
          productIdsAll
        );
        for (const r of prows) {
          const oos = Number(r.stock_quantity) === 0;
          const isPre = oos && hasPreorderBadge({ badges: r.badges as string });
          preorderByProductId.set(r.id as string, isPre);
          if (isPre && r.preorder_release_date) {
            const d = String(r.preorder_release_date).slice(0, 10);
            if (!expectedDate || d > expectedDate) expectedDate = d; // latest across lines
          }
        }
      }
      body.items.forEach((item: { product_id?: string }, idx: number) => {
        preorderByItemIndex.set(idx, !!(item.product_id && preorderByProductId.get(item.product_id)));
      });

      const preorderCount = Array.from(preorderByItemIndex.values()).filter(Boolean).length;
      isPreorderOrder = preorderCount > 0;

      // Separate-checkout rule: a cart must be all pre-order or all in-stock,
      // never mixed (they have different fulfilment timelines). The client
      // prevents mixing; this enforces it server-side.
      if (isPreorderOrder && preorderCount < body.items.length) {
        await conn.rollback();
        conn.release();
        return NextResponse.json({
          error: "Pre-order items must be checked out separately from in-stock items.",
        }, { status: 400 });
      }

      if (variantIndices.length > 0) {
        const variantIds = variantIndices.map((idx) => body.items[idx].variant_id);
        const placeholders = variantIds.map(() => "?").join(",");
        const [rows] = await conn.execute<StockRow[]>(
          `SELECT pv.id AS variant_id, pv.stock, p.name, p.cost_price, pv.cost_price_adjustment
           FROM product_variants pv JOIN products p ON p.id = pv.product_id
           WHERE pv.id IN (${placeholders}) FOR UPDATE`,
          variantIds
        );
        const byVariantId = new Map(rows.map((r) => [r.variant_id as string, r]));
        for (const idx of variantIndices) {
          const item = body.items[idx];
          const row = byVariantId.get(item.variant_id);
          if (!row) continue;
          // Pre-order lines bypass the stock check entirely (they're expected
          // to be out of stock — that's the whole point).
          const available = Number(row.stock);
          if (!preorderByItemIndex.get(idx) && available < item.quantity) {
            outOfStock.push(`${row.name} (only ${available} left, you requested ${item.quantity})`);
          }
          costByItemIndex.set(idx, (Number(row.cost_price) || 0) + (Number(row.cost_price_adjustment) || 0));
        }
      }

      if (plainIndices.length > 0) {
        const productIds = plainIndices.map((idx) => body.items[idx].product_id);
        const placeholders = productIds.map(() => "?").join(",");
        const [rows] = await conn.execute<StockRow[]>(
          `SELECT id, stock_quantity, name, cost_price FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
          productIds
        );
        const byProductId = new Map(rows.map((r) => [r.id as string, r]));
        for (const idx of plainIndices) {
          const item = body.items[idx];
          const row = byProductId.get(item.product_id);
          if (!row) continue;
          const available = Number(row.stock_quantity);
          if (!preorderByItemIndex.get(idx) && available < item.quantity) {
            outOfStock.push(`${row.name} (only ${available} left, you requested ${item.quantity})`);
          }
          costByItemIndex.set(idx, Number(row.cost_price) || 0);
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

      // Stock is valid — deduct now inside the same transaction. Pre-orders
      // deduct NOTHING: no stock exists yet; the admin deducts it later when
      // fulfilling (converting preorder → confirmed).
      if (!isPreorderOrder) {
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
      }

      // Create the order inside the transaction. A pre-order starts in its own
      // 'preorder' status (COD, unpaid, stock NOT deducted); everything else is
      // the existing 'pending' + stock-deducted path, unchanged.
      const source = body.source === "manual" ? "manual" : "website";
      const initialStatus = isPreorderOrder ? "preorder" : "pending";
      await conn.execute(
        `INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, subtotal, shipping_cost, discount, tax, total, status, payment_method, payment_status, transaction_id, coupon_code, stock_deducted, is_preorder, preorder_expected_date, notes, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, orderNumber, customerId, body.customer_name, body.customer_phone, body.subtotal || 0, body.shipping_cost || 0, body.discount || 0, body.tax || 0, body.total || 0, initialStatus, (body.payment_method || "COD").toUpperCase(), "pending", body.transaction_id || null, body.coupon_code || null, isPreorderOrder ? 0 : 1, isPreorderOrder ? 1 : 0, isPreorderOrder ? expectedDate : null, body.notes || null, source]
      );

      // Order items
      if (body.items?.length) {
        for (let i = 0; i < body.items.length; i++) {
          const item = body.items[i];
          await conn.execute(
            "INSERT INTO order_items (id, order_id, product_id, variant_id, product_name, product_image, product_slug, variant, quantity, unit_price, total_price, cost_price_snapshot, is_preorder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [`oi-${id}-${i}`, id, item.product_id || null, item.variant_id || null, item.product_name, item.product_image || null, item.product_slug || null, item.variant || null, item.quantity, item.unit_price, item.total_price || item.unit_price * item.quantity, costByItemIndex.get(i) || 0, preorderByItemIndex.get(i) ? 1 : 0]
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
    if (isPreorderOrder) {
      await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'preorder', 'Pre-order placed — reserved, pay on delivery when stock arrives')", [id]);
    } else {
      await execute("INSERT INTO order_timeline (order_id, status, note) VALUES (?, 'pending', 'Order placed — stock reserved')", [id]);
    }

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

    // ─── Admin notifications: new order + any items that fell to low stock ───
    await notifyAdmin(
      "order",
      `New order ${orderNumber}`,
      `${body.customer_name} — ৳${Number(body.total).toLocaleString("en-BD")} via ${body.payment_method || "COD"} (${body.items.length} item${body.items.length > 1 ? "s" : ""})`,
      `/admin/orders/${id}`
    );
    try {
      const productIds = [...new Set((body.items as { product_id?: string }[]).map((i) => i.product_id).filter(Boolean))] as string[];
      if (productIds.length > 0) {
        const placeholders = productIds.map(() => "?").join(",");
        const lowStock = await query<RowDataPacket[]>(
          `SELECT name, stock_quantity, min_stock FROM products WHERE id IN (${placeholders}) AND stock_quantity <= min_stock`,
          productIds
        );
        for (const p of lowStock) {
          await notifyAdmin(
            "stock",
            Number(p.stock_quantity) === 0 ? `Out of stock: ${p.name}` : `Low stock: ${p.name}`,
            `${p.stock_quantity} left (minimum ${p.min_stock}). Restock soon.`,
            "/admin/stock"
          );
        }
      }
    } catch {}

    return NextResponse.json({ success: true, id, order_number: orderNumber }, { status: 201 });
  } catch (error: unknown) {
    return publicServerError("POST /api/orders", error);
  }
}
