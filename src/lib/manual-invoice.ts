import { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { execute } from "@/lib/db";
import { currentYear2 } from "@/lib/order-number";

// ─── Manual invoice: numbering + money math ──────────────────────────────────
// Shared by every route that touches an invoice, so the totals shown in the
// builder, stored in the database and printed on the document can never
// disagree. The UI computes the same figures for live preview, but the server
// ALWAYS recomputes from the stored lines on save — a client-supplied total is
// never trusted (the same discipline the order route applies).

export const VOUCHER_PREFIX = "INV-";
const PAD = 6;

/** e.g. "INV-26-" */
function voucherPrefix(yy: string): string {
  return `${VOUCHER_PREFIX}${yy}-`;
}

function counterName(yy: string): string {
  return `invoice_voucher:${yy}`;
}

export function formatVoucherNo(n: number, yy: string = currentYear2()): string {
  return `${voucherPrefix(yy)}${String(n).padStart(PAD, "0")}`;
}

let ensuredYear = "";

/**
 * Idempotent: creates the shared counters table (if the order allocator hasn't
 * already) and seeds this year's voucher counter past any existing invoices, so
 * a database that already holds invoices continues its sequence instead of
 * restarting at 1 and colliding on the unique voucher key.
 */
export async function ensureVoucherCounter(): Promise<void> {
  if (ensuredYear === currentYear2()) return;
  await execute(
    `CREATE TABLE IF NOT EXISTS counters (
      name VARCHAR(50) PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`
  );
  const yy = currentYear2();
  await execute(
    `INSERT INTO counters (name, value)
     SELECT ?, COALESCE(MAX(CAST(SUBSTRING(voucher_no, ?) AS UNSIGNED)), 0)
       FROM manual_invoices WHERE voucher_no LIKE ?
     ON DUPLICATE KEY UPDATE value = value`,
    [counterName(yy), voucherPrefix(yy).length + 1, `${voucherPrefix(yy)}%`]
  );
  ensuredYear = yy;
}

/**
 * Reserve the next voucher number inside the caller's transaction.
 *
 * Same row-lock discipline as nextOrderNumber: UPDATE before SELECT, because a
 * SELECT-then-UPDATE under REPEATABLE READ hands two concurrent transactions the
 * same value. Rolling back releases the number rather than burning it.
 */
export async function nextVoucherNo(conn: PoolConnection): Promise<string> {
  const yy = currentYear2();
  const name = counterName(yy);
  await conn.execute(
    "INSERT INTO counters (name, value) VALUES (?, 0) ON DUPLICATE KEY UPDATE value = value",
    [name]
  );
  await conn.execute("UPDATE counters SET value = value + 1 WHERE name = ?", [name]);
  const [rows] = await conn.execute<RowDataPacket[]>("SELECT value FROM counters WHERE name = ?", [name]);
  const n = Number(rows[0]?.value);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Could not reserve a voucher number for ${yy}`);
  }
  return formatVoucherNo(n, yy);
}

// ── Money math ───────────────────────────────────────────────────────────────

export type DiscountType = "amount" | "percent";

export interface InvoiceLineInput {
  product_id?: string | null;
  variant_id?: string | null;
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  discount_type?: DiscountType;
  discount_value?: number;
}

export interface ComputedLine extends InvoiceLineInput {
  quantity: number;
  unit_price: number;
  discount_type: DiscountType;
  discount_value: number;
  line_discount: number;
  line_total: number;
}

export interface InvoiceTotals {
  lines: ComputedLine[];
  subtotal: number;
  lineDiscountTotal: number;
  orderDiscount: number;
  deliveryCharge: number;
  total: number;
}

/** Round to 2dp so stored DECIMAL(12,2) and displayed figures always agree. */
const money = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Resolve a discount to an absolute amount, clamped to the base.
 * A discount can never exceed what it applies to — a negative line or a negative
 * invoice is not a valid document.
 */
function resolveDiscount(base: number, type: DiscountType, value: number): number {
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  const raw = type === "percent" ? (base * v) / 100 : v;
  return money(Math.min(Math.max(raw, 0), base));
}

/**
 * Compute every figure on an invoice from its raw lines.
 *
 *   line total  = (qty x unit price) - line discount
 *   subtotal    = sum of line totals
 *   total       = subtotal - order discount + delivery
 *
 * The order discount applies to the subtotal (i.e. AFTER line discounts), and
 * delivery is added last so it is never discounted.
 */
export function computeInvoice(
  rawLines: InvoiceLineInput[],
  opts: { discountType?: DiscountType; discountValue?: number; deliveryCharge?: number } = {}
): InvoiceTotals {
  const lines: ComputedLine[] = (rawLines || []).map((l) => {
    const quantity = Math.max(1, Math.floor(Number(l.quantity) || 1));
    const unit_price = Math.max(0, money(l.unit_price));
    const discount_type: DiscountType = l.discount_type === "percent" ? "percent" : "amount";
    const discount_value = Math.max(0, Number(l.discount_value) || 0);
    const gross = money(quantity * unit_price);
    const line_discount = resolveDiscount(gross, discount_type, discount_value);
    return {
      ...l,
      quantity,
      unit_price,
      discount_type,
      discount_value,
      line_discount,
      line_total: money(gross - line_discount),
    };
  });

  const subtotal = money(lines.reduce((s, l) => s + l.line_total, 0));
  const lineDiscountTotal = money(lines.reduce((s, l) => s + l.line_discount, 0));

  const discountType: DiscountType = opts.discountType === "percent" ? "percent" : "amount";
  const orderDiscount = resolveDiscount(subtotal, discountType, Number(opts.discountValue) || 0);
  const deliveryCharge = Math.max(0, money(opts.deliveryCharge ?? 0));

  return {
    lines,
    subtotal,
    lineDiscountTotal,
    orderDiscount,
    deliveryCharge,
    total: money(Math.max(0, subtotal - orderDiscount) + deliveryCharge),
  };
}

export type InvoiceStatus = "draft" | "published" | "paid" | "void";

/** Permitted lifecycle moves. Anything absent here is rejected by the API. */
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["published"],
  published: ["paid", "void"],
  paid: [],
  void: [],
};

export function canTransition(from: string, to: InvoiceStatus): boolean {
  const allowed = INVOICE_TRANSITIONS[from as InvoiceStatus];
  return Array.isArray(allowed) && allowed.includes(to);
}
