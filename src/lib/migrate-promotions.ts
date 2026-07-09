import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// ─── Auto-migration for offer/coupon promotion columns ───
// Ensures the structured-discount + applicability columns exist on existing
// databases. Only latches as "done" once the columns are confirmed present, so
// a transient failure (e.g. table missing on first boot) is retried later
// instead of being permanently skipped.
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

/** Drop a column only if it's currently present (idempotent, no error on re-run). */
async function dropColumnIfExists(table: string, column: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (Number(rows[0]?.c) === 0) return;
  await execute(`ALTER TABLE ${table} DROP COLUMN ${column}`);
}

/**
 * Widen an existing ENUM column to a new set of values (idempotent — checks
 * the column's current definition first via information_schema, since MySQL
 * has no "ADD ENUM VALUE IF NOT EXISTS"). Needed when a column was created by
 * an older schema and already exists, so ensureColumn's "already present" skip
 * would otherwise leave the old, narrower enum in place forever.
 */
async function ensureEnumValues(table: string, column: string, values: string[]) {
  const rows = await query<RowDataPacket[]>(
    `SELECT COLUMN_TYPE AS type FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  if (rows.length === 0) return; // column doesn't exist yet — ensureColumn will create it with the full enum
  const currentType = String(rows[0].type); // e.g. "enum('store','categories',...)"
  const missing = values.filter((v) => !currentType.includes(`'${v}'`));
  if (missing.length === 0) return;
  const enumList = values.map((v) => `'${v}'`).join(",");
  await execute(`ALTER TABLE ${table} MODIFY COLUMN ${column} ENUM(${enumList}) DEFAULT 'store'`);
}

export async function ensurePromotionColumns() {
  if (done) return;
  try {
    // Offers: structured discount so offers actually reduce cart prices
    await ensureColumn("offers", "discount_type", "ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage'");
    await ensureColumn("offers", "discount_value", "DECIMAL(10,2) NOT NULL DEFAULT 0");
    await ensureColumn("offers", "max_discount_amount", "DECIMAL(10,2)");

    // Coupons: applicability targeting + per-customer redemption limit
    const applicabilityValues = ["store", "categories", "subcategories", "products", "brands", "customers", "tiers"];
    await ensureColumn("coupons", "applicability", `ENUM(${applicabilityValues.map((v) => `'${v}'`).join(",")}) DEFAULT 'store'`);
    await ensureColumn("coupons", "applicable_ids", "JSON");
    await ensureColumn("coupons", "per_customer_limit", "INT");
    await ensureEnumValues("coupons", "applicability", applicabilityValues);
    await ensureEnumValues("offers", "applicability", applicabilityValues);

    // Products: trust badges shown on the product page (referenced by create/update)
    await ensureColumn("products", "trust_badges", "JSON");

    // Brands: homepage visibility flag (referenced by brands/[id] before list route)
    await ensureColumn("brands", "show_on_homepage", "BOOLEAN DEFAULT FALSE");

    // Customers: registered (went through /api/auth register or reset_password,
    // i.e. has a real password) vs temporary (auto-created from a guest checkout)
    await ensureColumn("customers", "account_type", "ENUM('registered', 'temporary') NOT NULL DEFAULT 'temporary'");

    // Membership tiers: superseded by applicability-based delivery_rules below —
    // drop the short-lived per-tier columns from that earlier iteration.
    await dropColumnIfExists("membership_tiers", "free_delivery");
    await dropColumnIfExists("membership_tiers", "free_express_delivery");

    // Delivery rules: free (standard) / free express delivery, targeted using
    // the same applicability model as offers/coupons. One row per rule type
    // ("standard" | "express"); site-wide config lives in `settings` still.
    await execute(`
      CREATE TABLE IF NOT EXISTS delivery_rules (
        id VARCHAR(50) PRIMARY KEY,
        rule_type ENUM('standard', 'express') NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT FALSE,
        applicability ENUM(${applicabilityValues.map((v) => `'${v}'`).join(",")}) DEFAULT 'store',
        applicable_ids JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // Banners: per-banner hero display customization (title/description
    // toggles, position, animation, overlay, carousel transition + timing)
    await ensureColumn("banners", "settings", "JSON");

    // Membership tiers: explicit badge visibility, independent of badge_color —
    // previously inferred from `!!badge_color`, which meant disabling the badge
    // destroyed the configured color instead of just hiding it.
    await ensureColumn("membership_tiers", "badge_enabled", "BOOLEAN NOT NULL DEFAULT FALSE");

    done = true; // only latch once every column is confirmed/created
  } catch (err) {
    // Leave `done` false so the next request retries the migration.
    console.error("[ensurePromotionColumns] migration failed:", err);
  }
}
