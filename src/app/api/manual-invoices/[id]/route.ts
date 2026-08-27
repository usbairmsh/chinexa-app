import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query, execute } from "@/lib/db";
import { requirePermission } from "@/lib/admin-permissions-server";
import { ensureManualInvoiceTables } from "@/lib/migrate-manual-invoices";
import { computeInvoice, type InvoiceLineInput } from "@/lib/manual-invoice";
import { logActivity } from "@/lib/log-activity";
import { publicServerError, validationError } from "@/lib/validate";

export const dynamic = "force-dynamic";

async function loadInvoice(id: string) {
  const rows = await query<RowDataPacket[]>("SELECT * FROM manual_invoices WHERE id = ? OR voucher_no = ? LIMIT 1", [id, id]);
  if (rows.length === 0) return null;
  const inv = rows[0];
  const items = await query<RowDataPacket[]>(
    "SELECT * FROM manual_invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC",
    [inv.id]
  );
  return { ...inv, affects_inventory: !!inv.affects_inventory, items };
}

// ─── GET — full invoice for the detail and print views ───────────────────────
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "accounting", "view");
  if (denied) return denied;
  try {
    await ensureManualInvoiceTables();
    const { id } = await params;
    const invoice = await loadInvoice(id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json(invoice, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return publicServerError("GET /api/manual-invoices/[id]", error);
  }
}

// ─── PUT — edit an invoice in ANY state ──────────────────────────────────────
// Manual invoices are an internal document the business controls, so they stay
// correctable at every stage — a typo on a paid invoice should be fixable rather
// than requiring an offsetting entry.
//
// The consequence to respect: a PAID + accountable invoice has already moved
// stock and revenue against its OLD lines. Editing therefore reverses the old
// stock movement and re-applies the new one, so inventory continues to match
// what the invoice actually says. Revenue needs no such step — accounting reads
// the invoice's current total live, so it follows the edit on its own.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "accounting", "edit");
  if (denied) return denied;

  try {
    await ensureManualInvoiceTables();
    const { id } = await params;
    const existing = await query<RowDataPacket[]>(
      "SELECT id, status, affects_inventory, stock_applied FROM manual_invoices WHERE id = ? LIMIT 1",
      [id]
    );
    if (existing.length === 0) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    const prev = existing[0];

    const body = await req.json().catch(() => ({}));
    const customerName = String(body.customer_name || "").trim();
    if (!customerName) return validationError("Customer name is required");
    const rawLines: InvoiceLineInput[] = Array.isArray(body.items) ? body.items : [];
    if (rawLines.length === 0) return validationError("Add at least one product");
    // Same per-line validation as create — without it a draft could be edited
    // into a state the create route would have rejected, since computeInvoice
    // coerces bad input rather than refusing it.
    for (const l of rawLines) {
      if (!String(l.product_name || "").trim()) return validationError("Every line needs a product");
      if (!Number.isFinite(Number(l.quantity)) || Number(l.quantity) < 1) {
        return validationError(`Invalid quantity for "${l.product_name}"`);
      }
      if (!Number.isFinite(Number(l.unit_price)) || Number(l.unit_price) < 0) {
        return validationError(`Invalid price for "${l.product_name}"`);
      }
    }

    const totals = computeInvoice(rawLines, {
      discountType: body.discount_type,
      discountValue: body.discount_value,
      deliveryCharge: body.delivery_charge,
    });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Reverse the stock this invoice previously took, BEFORE writing the new
      // lines — otherwise an edit would double-count. Only applies when stock
      // was actually applied (a paid + accountable invoice); a draft has moved
      // nothing, so there is nothing to give back.
      const hadStock = Boolean(prev.stock_applied);
      if (hadStock) {
        const oldLines = await query<RowDataPacket[]>(
          "SELECT product_id, variant_id, quantity FROM manual_invoice_items WHERE invoice_id = ?",
          [id]
        );
        for (const ol of oldLines) {
          if (!ol.product_id) continue;
          const q = Number(ol.quantity) || 0;
          if (q <= 0) continue;
          if (ol.variant_id) {
            await conn.execute("UPDATE product_variants SET stock = stock + ? WHERE id = ?", [q, ol.variant_id]);
          }
          await conn.execute("UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?", [q, ol.product_id]);
        }
      }

      await conn.execute(
        `UPDATE manual_invoices SET
           customer_id = ?, customer_name = ?, customer_phone = ?, customer_email = ?, customer_address = ?,
           subtotal = ?, line_discount_total = ?, discount_type = ?, discount_value = ?,
           order_discount = ?, delivery_charge = ?, total = ?, affects_inventory = ?,
           notes = ?, seal_url = ?, signature_url = ?
         WHERE id = ?`,
        [
          body.customer_id || null, customerName,
          String(body.customer_phone || "").trim() || null,
          String(body.customer_email || "").trim() || null,
          String(body.customer_address || "").trim() || null,
          totals.subtotal, totals.lineDiscountTotal,
          body.discount_type === "percent" ? "percent" : "amount",
          Math.max(0, Number(body.discount_value) || 0),
          totals.orderDiscount, totals.deliveryCharge, totals.total,
          body.affects_inventory === true ? 1 : 0,
          String(body.notes || "").trim() || null,
          String(body.seal_url || "").trim() || null,
          String(body.signature_url || "").trim() || null,
          id,
        ]
      );
      await conn.execute("DELETE FROM manual_invoice_items WHERE invoice_id = ?", [id]);
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

      // Re-apply stock against the NEW lines. Runs whenever this invoice had
      // stock applied before the edit and is still accountable — so changing a
      // quantity, swapping a product, or removing a line all leave inventory
      // matching the invoice. Floors at zero, as everywhere else.
      const stillAccountable = body.affects_inventory === true;
      if (hadStock && stillAccountable) {
        for (const l of totals.lines) {
          if (!l.product_id) continue;
          const q = Number(l.quantity) || 0;
          if (q <= 0) continue;
          if (l.variant_id) {
            await conn.execute("UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ?", [q, l.variant_id]);
          }
          await conn.execute("UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?", [q, l.product_id]);
        }
      } else if (hadStock && !stillAccountable) {
        // The accounting toggle was switched OFF during the edit: the stock was
        // handed back above and must not be taken again, so clear the flag.
        await conn.execute("UPDATE manual_invoices SET stock_applied = FALSE, revenue_applied = FALSE WHERE id = ?", [id]);
      }

      await conn.commit();
      conn.release();
      await logActivity("Manual invoice updated", "accounting", id).catch(() => {});
      return NextResponse.json({ success: true });
    } catch (txErr) {
      await conn.rollback().catch(() => {});
      conn.release();
      throw txErr;
    }
  } catch (error) {
    return publicServerError("PUT /api/manual-invoices/[id]", error);
  }
}

// ─── DELETE — remove a DRAFT ─────────────────────────────────────────────────
// Published invoices are VOIDED, never deleted, so the register stays complete
// for audit. Paid invoices are permanent.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission(req, "accounting", "delete");
  if (denied) return denied;
  try {
    await ensureManualInvoiceTables();
    const { id } = await params;
    const rows = await query<RowDataPacket[]>("SELECT id, status, voucher_no FROM manual_invoices WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (rows[0].status !== "draft") {
      return NextResponse.json(
        { error: "Only a draft can be deleted. Void a published invoice instead — paid invoices are permanent." },
        { status: 409 }
      );
    }
    // Items cascade via the foreign key.
    await execute("DELETE FROM manual_invoices WHERE id = ? AND status = 'draft'", [id]);
    await logActivity("Manual invoice deleted", "accounting", id, String(rows[0].voucher_no)).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (error) {
    return publicServerError("DELETE /api/manual-invoices/[id]", error);
  }
}
