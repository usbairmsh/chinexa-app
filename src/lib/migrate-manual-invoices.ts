import { execute } from "@/lib/db";

// ─── Manual invoices ──────────────────────────────────────────────────────────
// An admin raises an invoice directly, without a storefront order behind it —
// for a walk-in, a social-media sale, a service charge, or a quotation.
//
// These live in their OWN register and are never written to `orders`. That is
// the whole point: an invoice may or may not be financially real, and the
// `affects_inventory` flag is only meaningful if a non-accountable invoice can't
// leak into revenue, order counts or customer statistics. Storing them as orders
// is exactly the contamination that had to be undone for standalone payment
// links, so the same firewall is applied here from the start.
//
// Two independent toggles, decided at creation:
//   • affects_inventory — when true, marking the invoice PAID deducts stock and
//     recognises revenue. When false the invoice is a document only and never
//     moves either. It is NOT applied at create or publish: an unpaid invoice is
//     not a sale, and recognising it earlier would inflate both figures.
//   • order_number — when set, the invoice was allocated a real number from the
//     shared order counter and prints it as a reference. It does NOT create an
//     order row; the number exists so the business keeps one continuous
//     numbering scheme. Consuming numbers this way leaves visible gaps in the
//     order list, which was accepted as the cost of guaranteed uniqueness.
//
// Lifecycle: draft → published → paid, plus void (from published only).
//   draft     — fully editable, deletable, no financial effect
//   published — locked for editing, issued to the customer, voidable
//   paid      — terminal. Stock/revenue applied here if affects_inventory.
//   void      — a published invoice withdrawn before payment; kept for audit
//
// stock_applied / revenue_applied are persisted guards rather than status
// checks, mirroring orders.stock_deducted — marking paid twice (double-click,
// retry, two admins) must never deduct stock or count revenue twice.

let done = false;

export async function ensureManualInvoiceTables(): Promise<void> {
  if (done) return;
  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS manual_invoices (
        id VARCHAR(50) PRIMARY KEY,
        voucher_no VARCHAR(40) NOT NULL,
        order_number VARCHAR(50) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',

        customer_id VARCHAR(50) NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NULL,
        customer_email VARCHAR(255) NULL,
        customer_address TEXT NULL,

        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        line_discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        discount_type VARCHAR(12) NOT NULL DEFAULT 'amount',
        discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
        order_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        delivery_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL DEFAULT 0,

        affects_inventory BOOLEAN NOT NULL DEFAULT FALSE,
        stock_applied BOOLEAN NOT NULL DEFAULT FALSE,
        revenue_applied BOOLEAN NOT NULL DEFAULT FALSE,

        payment_method VARCHAR(40) NULL,
        paid_at TIMESTAMP NULL,
        published_at TIMESTAMP NULL,
        voided_at TIMESTAMP NULL,
        void_reason VARCHAR(255) NULL,

        notes TEXT NULL,
        seal_url VARCHAR(500) NULL,
        signature_url VARCHAR(500) NULL,

        created_by VARCHAR(50) NULL,
        created_by_name VARCHAR(100) NULL,
        paid_by VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uniq_voucher (voucher_no),
        INDEX idx_status (status),
        INDEX idx_created (created_at),
        INDEX idx_customer (customer_id)
      ) ENGINE=InnoDB`
    );

    // Line items are a SNAPSHOT of what was sold. Name and price are copied in
    // rather than joined live, so renaming a product or changing its catalogue
    // price can never retroactively alter an already-issued document.
    // product_id/variant_id are kept (nullable) purely so a stock-affecting
    // invoice knows what to deduct — they are not used for display.
    await execute(
      `CREATE TABLE IF NOT EXISTS manual_invoice_items (
        id VARCHAR(50) PRIMARY KEY,
        invoice_id VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NULL,
        variant_id VARCHAR(50) NULL,
        product_name VARCHAR(255) NOT NULL,
        variant_name VARCHAR(255) NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        discount_type VARCHAR(12) NOT NULL DEFAULT 'amount',
        discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
        line_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        INDEX idx_invoice (invoice_id),
        CONSTRAINT fk_manual_invoice_items_invoice
          FOREIGN KEY (invoice_id) REFERENCES manual_invoices(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`
    );

    done = true;
  } catch (err) {
    console.error("[ensureManualInvoiceTables] migration failed:", err);
    // Rethrow: a route must not proceed against a schema that isn't ready.
    throw err;
  }
}
