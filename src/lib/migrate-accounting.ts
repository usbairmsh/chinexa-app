import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// ─── Auto-migration for the accounting module ───
// Adds cost-price columns to products/variants/order_items, a source column
// to orders, and the expenses/import-batches/partners/loans tables. Only
// latches as "done" once everything is confirmed present, so a transient
// failure (e.g. table missing on first boot) is retried later instead of
// permanently skipped.
let done = false;

/** Add a column only if it isn't already present (idempotent, no error on re-run). */
async function ensureColumn(table: string, column: string, definition: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (Number(rows[0]?.c) > 0) return;
  await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** Add an index only if it isn't already present (idempotent, no error on re-run). */
async function ensureIndex(table: string, indexName: string, columns: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  if (Number(rows[0]?.c) > 0) return;
  await execute(`ALTER TABLE ${table} ADD INDEX ${indexName} (${columns})`);
}

export async function ensureAccountingTables() {
  if (done) return;
  try {
    // Cost-price plumbing for profit/COGS calculation
    await ensureColumn("products", "cost_price", "DECIMAL(10,2) DEFAULT 0");
    await ensureColumn("product_variants", "cost_price_adjustment", "DECIMAL(10,2) DEFAULT 0");
    await ensureColumn("order_items", "cost_price_snapshot", "DECIMAL(10,2) DEFAULT 0");

    // Distinguish real website checkout orders from manually-recorded (Facebook) sales
    await ensureColumn("orders", "source", "ENUM('website','manual') NOT NULL DEFAULT 'website'");

    await execute(`
      CREATE TABLE IF NOT EXISTS expense_categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(50) PRIMARY KEY,
        category_id VARCHAR(50) NOT NULL,
        category_name VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description VARCHAR(500),
        expense_date DATE NOT NULL,
        payment_method VARCHAR(50),
        receipt_url VARCHAR(500),
        created_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT,
        INDEX idx_expenses_date (expense_date),
        INDEX idx_expenses_category (category_id)
      ) ENGINE=InnoDB
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS import_batches (
        id VARCHAR(50) PRIMARY KEY,
        product_id VARCHAR(50) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity_imported INT NOT NULL,
        import_cost_total DECIMAL(12,2) NOT NULL,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        customs_cost DECIMAL(10,2) DEFAULT 0,
        other_cost DECIMAL(10,2) DEFAULT 0,
        landed_cost_per_unit DECIMAL(10,2) NOT NULL,
        batch_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_import_batches_product (product_id),
        INDEX idx_import_batches_date (batch_date)
      ) ENGINE=InnoDB
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS partners (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        initial_investment DECIMAL(12,2) NOT NULL DEFAULT 0,
        share_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
        join_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS partner_transactions (
        id VARCHAR(50) PRIMARY KEY,
        partner_id VARCHAR(50) NOT NULL,
        type ENUM('investment','withdrawal','profit_distribution') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        transaction_date DATE NOT NULL,
        note VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
        INDEX idx_partner_txn_partner (partner_id),
        INDEX idx_partner_txn_date (transaction_date)
      ) ENGINE=InnoDB
    `);

    // Loans — debt financing, kept as a separate concept from partner equity
    // (partners = investment/withdrawal/profit_distribution; loans = a
    // principal owed to a lender, serviced via loan_repayments). "Hybrid"
    // funding (installment + profit share) is modeled as a partner who also
    // has a linked loan, not a third unified table.
    await execute(`
      CREATE TABLE IF NOT EXISTS loans (
        id VARCHAR(50) PRIMARY KEY,
        lender_name VARCHAR(255) NOT NULL,
        lender_type ENUM('bank','company','person') NOT NULL DEFAULT 'bank',
        principal DECIMAL(12,2) NOT NULL,
        interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        repayment_type ENUM('installment','profit_based','mixed') NOT NULL DEFAULT 'installment',
        start_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // Append-only repayment ledger — same "derive don't duplicate" philosophy
    // as partner_transactions. due_amount is computed live from principal vs.
    // SUM(type='principal') repayments, never a stored running balance.
    await execute(`
      CREATE TABLE IF NOT EXISTS loan_repayments (
        id VARCHAR(50) PRIMARY KEY,
        loan_id VARCHAR(50) NOT NULL,
        type ENUM('principal','interest') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        repayment_date DATE NOT NULL,
        note VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
        INDEX idx_loan_repayments_loan (loan_id),
        INDEX idx_loan_repayments_date (repayment_date)
      ) ENGINE=InnoDB
    `);

    await execute(`
      INSERT IGNORE INTO expense_categories (id, name, sort_order) VALUES
        ('exp-cat-ads', 'Ads', 1),
        ('exp-cat-delivery', 'Delivery', 2),
        ('exp-cat-packaging', 'Packaging', 3),
        ('exp-cat-import', 'Import Cost', 4),
        ('exp-cat-website', 'Website Cost', 5),
        ('exp-cat-salary', 'Salary', 6)
    `);

    // Cross-cutting query-performance indexes — orders/order_items had no
    // secondary indexes at all beyond the PK/unique/FK-implicit ones, despite
    // being filtered/sorted on status/payment_status/created_at/customer_id
    // in nearly every admin, analytics, and accounting query in the app.
    await ensureIndex("orders", "idx_orders_status_created", "status, created_at");
    await ensureIndex("orders", "idx_orders_customer_created", "customer_id, created_at");
    await ensureIndex("orders", "idx_orders_payment_status", "payment_status, status");
    await ensureIndex("order_items", "idx_order_items_variant", "variant_id");

    done = true; // only latch once everything is confirmed/created
  } catch (err) {
    console.error("[ensureAccountingTables] migration failed:", err);
  }
}
