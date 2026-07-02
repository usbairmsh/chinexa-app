import { execute } from "@/lib/db";

// ─── One-time auto-migration for offer/coupon promotion columns ───
// Runs idempotently; each ALTER is wrapped in catch so re-runs are no-ops.
let migrated = false;

export async function ensurePromotionColumns() {
  if (migrated) return;
  migrated = true;
  try {
    // Offers: structured discount so offers actually reduce cart prices
    await execute("ALTER TABLE offers ADD COLUMN discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage'").catch(() => {});
    await execute("ALTER TABLE offers ADD COLUMN discount_value DECIMAL(10,2) NOT NULL DEFAULT 0").catch(() => {});
    await execute("ALTER TABLE offers ADD COLUMN max_discount_amount DECIMAL(10,2)").catch(() => {});

    // Coupons: applicability targeting + per-customer redemption limit
    await execute("ALTER TABLE coupons ADD COLUMN applicability ENUM('store', 'categories', 'subcategories', 'products', 'customers', 'tiers') DEFAULT 'store'").catch(() => {});
    await execute("ALTER TABLE coupons ADD COLUMN applicable_ids JSON").catch(() => {});
    await execute("ALTER TABLE coupons ADD COLUMN per_customer_limit INT").catch(() => {});
  } catch {
    // Columns likely already exist
  }
}
