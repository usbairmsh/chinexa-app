import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import pool, { query } from "@/lib/db";
import { getRequester, requirePermission } from "@/lib/admin-permissions-server";
import { ensureManualInvoiceTables } from "@/lib/migrate-manual-invoices";
import { canTransition, type InvoiceStatus } from "@/lib/manual-invoice";
import { logActivity } from "@/lib/log-activity";
import { publicServerError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// ─── POST /api/manual-invoices/[id]/status — drive the lifecycle ─────────────
// body: { to: "published" | "paid" | "void", payment_method?, void_reason?,
//         allow_negative_stock?: boolean, skip_stock?: boolean }
//
// Transitions are validated against an explicit matrix (draft→published,
// published→paid|void, paid→nothing). Orders famously allow any status to jump
// to any other; that is not repeated here.
//
// PAID is the only state with a financial effect, and only when the invoice was
// marked affects_inventory at creation. Stock deduction and revenue recognition
// are guarded by persisted flags (stock_applied / revenue_applied) rather than
// by the status alone, so a double-click, a retry, or two admins acting at once
// can never apply either twice.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Gated on accounting:edit — the same bar as editing the invoice itself.
  const denied = await requirePermission(req, "accounting", "edit");
  if (denied) return denied;

  try {
    await ensureManualInvoiceTables();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const to = String(body.to || "") as InvoiceStatus;
    if (!["published", "paid", "void"].includes(to)) {
      return NextResponse.json({ error: "Invalid target status" }, { status: 400 });
    }

    const rows = await query<RowDataPacket[]>("SELECT * FROM manual_invoices WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    const inv = rows[0];
    const from = String(inv.status);

    if (!canTransition(from, to)) {
      return NextResponse.json(
        { error: `Cannot move an invoice from ${from} to ${to}.` },
        { status: 409 }
      );
    }

    // ── PUBLISH ── locks editing; no financial effect.
    if (to === "published") {
      const items = await query<RowDataPacket[]>("SELECT COUNT(*) AS c FROM manual_invoice_items WHERE invoice_id = ?", [id]);
      if ((Number(items[0]?.c) || 0) === 0) {
        return NextResponse.json({ error: "An invoice with no items cannot be published." }, { status: 409 });
      }
      const [pubRes] = await pool.execute(
        "UPDATE manual_invoices SET status = 'published', published_at = NOW() WHERE id = ? AND status = 'draft'",
        [id]
      );
      // Only report success if this call actually moved the row — two admins
      // acting at once must not both be told they published it.
      if (((pubRes as { affectedRows?: number }).affectedRows ?? 0) === 0) {
        return NextResponse.json({ error: "This invoice is no longer a draft." }, { status: 409 });
      }
      await logActivity("Manual invoice published", "accounting", id, String(inv.voucher_no)).catch(() => {});
      return NextResponse.json({ success: true, status: "published" });
    }

    // ── VOID ── withdraws a published invoice; stays in the register for audit.
    if (to === "void") {
      const [voidRes] = await pool.execute(
        "UPDATE manual_invoices SET status = 'void', voided_at = NOW(), void_reason = ? WHERE id = ? AND status = 'published'",
        [String(body.void_reason || "").slice(0, 255) || null, id]
      );
      if (((voidRes as { affectedRows?: number }).affectedRows ?? 0) === 0) {
        return NextResponse.json({ error: "This invoice can no longer be voided." }, { status: 409 });
      }
      await logActivity("Manual invoice voided", "accounting", id, String(inv.voucher_no)).catch(() => {});
      return NextResponse.json({ success: true, status: "void" });
    }

    // ── PAID ── the financial event.
    const affects = !!inv.affects_inventory;
    const skipStock = body.skip_stock === true;
    const allowNegative = body.allow_negative_stock === true;

    const lines = await query<RowDataPacket[]>(
      "SELECT product_id, variant_id, product_name, quantity FROM manual_invoice_items WHERE invoice_id = ?",
      [id]
    );

    // Pre-flight stock check. Only lines bound to a real product can move stock —
    // a free-typed line has no product_id and is a service/charge, not goods.
    if (affects && !skipStock) {
      const shortages: string[] = [];
      for (const l of lines) {
        if (!l.product_id) continue;
        const qty = Number(l.quantity) || 0;

        // Deduction below touches BOTH the variant row and the parent product's
        // stock_quantity, so BOTH must be checked. Checking only the variant let
        // a line with ample variant stock but an exhausted parent silently drive
        // products.stock_quantity negative.
        const p = await query<RowDataPacket[]>("SELECT stock_quantity FROM products WHERE id = ? LIMIT 1", [l.product_id]);
        if (p.length === 0) {
          // The product was deleted after the invoice was issued. Treat as a
          // shortage rather than failing open — the admin must decide, since the
          // deduction would otherwise silently no-op or corrupt a NULL.
          shortages.push(`${l.product_name} (product no longer exists)`);
          continue;
        }
        const productHave = Number(p[0]?.stock_quantity);
        if (!Number.isFinite(productHave)) {
          shortages.push(`${l.product_name} (stock not recorded)`);
          continue;
        }
        if (productHave < qty) {
          shortages.push(`${l.product_name} (have ${productHave}, need ${qty})`);
          continue;
        }

        if (l.variant_id) {
          const v = await query<RowDataPacket[]>("SELECT stock FROM product_variants WHERE id = ? LIMIT 1", [l.variant_id]);
          if (v.length === 0) {
            shortages.push(`${l.product_name} (variant no longer exists)`);
            continue;
          }
          const variantHave = Number(v[0]?.stock);
          if (!Number.isFinite(variantHave)) {
            shortages.push(`${l.product_name} (variant stock not recorded)`);
          } else if (variantHave < qty) {
            shortages.push(`${l.product_name} (have ${variantHave}, need ${qty})`);
          }
        }
      }
      // The invoice is already locked at this point, so the admin cannot go back
      // and change the toggle. Instead of blocking, surface the shortage and let
      // them choose explicitly — proceed anyway (stock goes negative, because the
      // goods have physically left the shelf) or record the sale without touching
      // stock. Never silently corrupt inventory.
      if (shortages.length > 0 && !allowNegative) {
        return NextResponse.json(
          {
            error: "insufficient_stock",
            message: "Not enough stock for some items.",
            shortages,
            choices: {
              allow_negative_stock: "Mark paid anyway — stock will go negative",
              skip_stock: "Mark paid without updating stock for this invoice",
            },
          },
          { status: 409 }
        );
      }
    }

    const requester = await getRequester(req);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Race-safe: only the caller whose UPDATE actually matches a still-unpaid
      // row proceeds to move stock and revenue.
      const [res] = await conn.execute(
        `UPDATE manual_invoices
            SET status = 'paid', paid_at = NOW(), payment_method = ?, paid_by = ?
          WHERE id = ? AND status = 'published'`,
        [String(body.payment_method || "").slice(0, 40) || null, requester?.id || null, id]
      );
      const affectedRows = (res as { affectedRows?: number }).affectedRows ?? 0;
      if (affectedRows === 0) {
        await conn.rollback();
        conn.release();
        return NextResponse.json({ error: "This invoice is no longer awaiting payment." }, { status: 409 });
      }

      // Stock: guarded by stock_applied so it can never run twice.
      if (affects && !skipStock && !inv.stock_applied) {
        for (const l of lines) {
          if (!l.product_id) continue;
          const qty = Number(l.quantity) || 0;
          if (qty <= 0) continue;
          // GREATEST(...,0) unless the admin explicitly chose to allow negative
          // stock. Without it a shortage the admin waved through would silently
          // corrupt inventory; with it, going negative is a deliberate decision.
          if (l.variant_id) {
            await conn.execute(
              allowNegative
                ? "UPDATE product_variants SET stock = stock - ? WHERE id = ?"
                : "UPDATE product_variants SET stock = GREATEST(stock - ?, 0) WHERE id = ?",
              [qty, l.variant_id]
            );
          }
          await conn.execute(
            allowNegative
              ? "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?"
              : "UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ?",
            [qty, l.product_id]
          );
        }
        await conn.execute("UPDATE manual_invoices SET stock_applied = TRUE WHERE id = ?", [id]);
      }

      // Revenue: the accounting module reads paid + accountable invoices, so the
      // flag is what marks this invoice as counted. Set in the same transaction
      // as the status change so the two can never disagree.
      if (affects && !inv.revenue_applied) {
        await conn.execute("UPDATE manual_invoices SET revenue_applied = TRUE WHERE id = ?", [id]);
      }

      await conn.commit();
      conn.release();

      await logActivity("Manual invoice marked paid", "accounting", id, String(inv.voucher_no)).catch(() => {});
      return NextResponse.json({ success: true, status: "paid", stock_applied: affects && !skipStock });
    } catch (txErr) {
      await conn.rollback().catch(() => {});
      conn.release();
      throw txErr;
    }
  } catch (error) {
    return publicServerError("POST /api/manual-invoices/[id]/status", error);
  }
}
