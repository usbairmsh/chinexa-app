import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, escapeLike } from "@/lib/db";
import { getRequester, requirePermission } from "@/lib/admin-permissions-server";
import { ensureManualInvoiceTables } from "@/lib/migrate-manual-invoices";
import { ensureVoucherCounter, nextVoucherNo, computeInvoice, type InvoiceLineInput } from "@/lib/manual-invoice";
import { nextOrderNumber, ensureOrderCounter } from "@/lib/order-number";
import { logActivity } from "@/lib/log-activity";
import { publicServerError, validationError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Manual invoices are an accounting-tier capability — the same bar as Record
// Sale and payment links, since an accountable invoice moves revenue and stock.

// ─── GET /api/manual-invoices — the register ─────────────────────────────────
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, "accounting", "view");
  if (denied) return denied;

  try {
    await ensureManualInvoiceTables();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const search = sp.get("search");
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.max(1, Math.min(Number(sp.get("page_size")) || 20, 100));

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];
    if (status && ["draft", "published", "paid", "void"].includes(status)) {
      where += " AND status = ?";
      params.push(status);
    }
    if (search) {
      where += " AND (voucher_no LIKE ? OR order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)";
      const q = `%${escapeLike(search)}%`;
      params.push(q, q, q, q);
    }

    const countRows = await query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM manual_invoices ${where}`, params);
    const total = Number(countRows[0]?.total) || 0;

    const offset = (page - 1) * pageSize;
    const rows = await query<RowDataPacket[]>(
      `SELECT id, voucher_no, order_number, status, customer_name, customer_phone,
              subtotal, line_discount_total, order_discount, delivery_charge, total,
              affects_inventory, payment_method, paid_at, created_by_name, created_at
         FROM manual_invoices ${where}
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
      params
    );

    // Lightweight totals for the register's stat tiles. Only PAID + accountable
    // invoices are counted as real money — everything else is a document.
    const stats = await query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS count_all,
         SUM(status = 'draft') AS count_draft,
         SUM(status = 'published') AS count_published,
         SUM(status = 'paid') AS count_paid,
         COALESCE(SUM(CASE WHEN status = 'paid' AND affects_inventory = 1 THEN total ELSE 0 END), 0) AS accountable_total
       FROM manual_invoices`
    );

    return NextResponse.json(
      {
        data: rows.map((r) => ({ ...r, affects_inventory: !!r.affects_inventory })),
        total,
        page,
        page_size: pageSize,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
        stats: stats[0] || {},
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return publicServerError("GET /api/manual-invoices", error);
  }
}

// ─── POST /api/manual-invoices — create a draft ──────────────────────────────
// Always creates a DRAFT. Nothing financial happens here, and nothing financial
// happens at publish either — stock and revenue are applied only at mark-paid
// (see the [id]/pay route), and only when affects_inventory is set.
export async function POST(req: NextRequest) {
  const denied = await requirePermission(req, "accounting", "add");
  if (denied) return denied;

  try {
    await ensureManualInvoiceTables();
    await ensureVoucherCounter();
    await ensureOrderCounter();

    const body = await req.json().catch(() => ({}));
    const customerName = String(body.customer_name || "").trim();
    if (!customerName) return validationError("Customer name is required");

    const rawLines: InvoiceLineInput[] = Array.isArray(body.items) ? body.items : [];
    if (rawLines.length === 0) return validationError("Add at least one product");
    for (const l of rawLines) {
      if (!String(l.product_name || "").trim()) return validationError("Every line needs a product");
      if (!Number.isFinite(Number(l.quantity)) || Number(l.quantity) < 1) {
        return validationError(`Invalid quantity for "${l.product_name}"`);
      }
      if (!Number.isFinite(Number(l.unit_price)) || Number(l.unit_price) < 0) {
        return validationError(`Invalid price for "${l.product_name}"`);
      }
    }

    // Totals are ALWAYS recomputed server-side; whatever the client sent is
    // ignored. The builder runs the same function for its live preview.
    const totals = computeInvoice(rawLines, {
      discountType: body.discount_type,
      discountValue: body.discount_value,
      deliveryCharge: body.delivery_charge,
    });

    const requester = await getRequester(req);
    const id = `minv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const wantsOrderNo = body.generate_order_number === true;
    const affectsInventory = body.affects_inventory === true;

    // "Save as paid" records a sale that has ALREADY happened (a walk-in, a
    // completed social-media sale) in one step, rather than forcing draft →
    // publish → mark paid for money already taken. The invoice is created
    // directly in the terminal `paid` state, which means it is immediately
    // locked — that is the deliberate trade for the shortcut.
    const payNow = body.payment_status === "paid";
    const paymentMethod = String(body.payment_method || "").slice(0, 40) || null;
    const initialStatus = payNow ? "paid" : "draft";

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Both numbers come from row-locked counters inside this transaction, so a
      // rollback releases them rather than burning them.
      const voucherNo = await nextVoucherNo(conn);
      const orderNumber = wantsOrderNo ? await nextOrderNumber(conn) : null;

      await conn.execute(
        `INSERT INTO manual_invoices
           (id, voucher_no, order_number, status, customer_id, customer_name, customer_phone,
            customer_email, customer_address, subtotal, line_discount_total, discount_type,
            discount_value, order_discount, delivery_charge, total, affects_inventory,
            payment_method, paid_at, published_at, paid_by,
            stock_applied, revenue_applied,
            notes, seal_url, signature_url, created_by, created_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, voucherNo, orderNumber, initialStatus,
          body.customer_id || null, customerName,
          String(body.customer_phone || "").trim() || null,
          String(body.customer_email || "").trim() || null,
          String(body.customer_address || "").trim() || null,
          totals.subtotal, totals.lineDiscountTotal,
          body.discount_type === "percent" ? "percent" : "amount",
          Math.max(0, Number(body.discount_value) || 0),
          totals.orderDiscount, totals.deliveryCharge, totals.total,
          affectsInventory ? 1 : 0,
          paymentMethod,
          // A paid-on-create invoice is also implicitly published — it was
          // issued and settled in one action.
          payNow ? new Date() : null,
          payNow ? new Date() : null,
          payNow ? (requester?.id || null) : null,
          // Stock and revenue are only ever applied when the accounting toggle
          // is on; a non-accountable invoice can be paid without moving either.
          payNow && affectsInventory ? 1 : 0,
          payNow && affectsInventory ? 1 : 0,
          String(body.notes || "").trim() || null,
          String(body.seal_url || "").trim() || null,
          String(body.signature_url || "").trim() || null,
          requester?.id || null,
          String(body.created_by_name || "").slice(0, 100) || null,
        ]
      );

      for (let i = 0; i < totals.lines.length; i++) {
        const l = totals.lines[i];
        await conn.execute(
          `INSERT INTO manual_invoice_items
             (id, invoice_id, product_id, variant_id, product_name, variant_name,
              quantity, unit_price, discount_type, discount_value, line_discount, line_total, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `mii-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            id, l.product_id || null, l.variant_id || null,
            String(l.product_name).slice(0, 255), l.variant_name || null,
            l.quantity, l.unit_price, l.discount_type, l.discount_value,
            l.line_discount, l.line_total, i,
          ]
        );
      }

      // Paid on create + accountable → deduct stock now, in the SAME transaction
      // as the invoice itself, so a failure can't leave a paid invoice with no
      // stock movement (or the reverse). Floors at zero: recording a sale must
      // never silently push inventory negative. Lines with no product_id are a
      // service or ad-hoc charge and move nothing.
      if (payNow && affectsInventory) {
        for (const l of totals.lines) {
          if (!l.product_id) continue;
          const qty = Number(l.quantity) || 0;
          if (qty <= 0) continue;
          if (l.variant_id) {
            await conn.execute("UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ?", [qty, l.variant_id]);
          }
          await conn.execute("UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?", [qty, l.product_id]);
        }
      }

      await conn.commit();
      conn.release();

      await logActivity(
        payNow ? "Manual invoice created and paid" : "Manual invoice created",
        "accounting", id, voucherNo
      ).catch(() => {});
      return NextResponse.json({ id, voucher_no: voucherNo, order_number: orderNumber, status: initialStatus }, { status: 201 });
    } catch (txErr) {
      await conn.rollback().catch(() => {});
      conn.release();
      throw txErr;
    }
  } catch (error) {
    return publicServerError("POST /api/manual-invoices", error);
  }
}
