import { execute, query, parseDbJson } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// Adds review-images support + one-review-per-product enforcement to an
// already-provisioned database. Idempotent, latches once everything succeeds
// so a transient failure (e.g. duplicate rows already existing when the
// unique index is added) is retried on the next request rather than
// permanently skipped.
let migrated = false;
export async function ensureReviewColumns() {
  if (migrated) return;
  try {
    const cols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'reviews' AND column_name IN ('images','order_id','customer_tier','customer_tier_color')`
    );
    const has = new Set(cols.map((r) => r.c as string));
    if (!has.has("images")) await execute("ALTER TABLE reviews ADD COLUMN images JSON");
    if (!has.has("order_id")) await execute("ALTER TABLE reviews ADD COLUMN order_id VARCHAR(50)");
    // Reviewer's membership tier, snapshotted at submit time (registered users
    // only; anonymous reviews leave these NULL → no badge). Stored so the
    // review list needs no membership join.
    if (!has.has("customer_tier")) await execute("ALTER TABLE reviews ADD COLUMN customer_tier VARCHAR(100) NULL");
    if (!has.has("customer_tier_color")) await execute("ALTER TABLE reviews ADD COLUMN customer_tier_color VARCHAR(20) NULL");

    const idx = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'reviews' AND index_name = 'uniq_customer_product_review'`
    );
    if (Number(idx[0]?.c) === 0) {
      // A database that already has duplicate (customer_id, product_id) rows
      // (from before this constraint existed) would fail to add the index —
      // that's caught and logged rather than blocking every future request;
      // an admin would need to manually dedupe those rows first.
      await execute("ALTER TABLE reviews ADD UNIQUE KEY uniq_customer_product_review (customer_id, product_id)");
    }
    migrated = true;
  } catch (err) {
    console.error("[ensureReviewColumns] migration failed:", err);
  }
}

/**
 * Server-side read of the `public_reviews` feature toggle (stored under the
 * `features` settings key). When ON, anyone — including unregistered visitors —
 * may submit a review (still moderated). When OFF (default), only logged-in
 * customers can submit. Defaults to FALSE so the behaviour doesn't change until
 * an admin explicitly opts in.
 */
export async function publicReviewsEnabled(): Promise<boolean> {
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'features' LIMIT 1");
    if (rows.length === 0) return false;
    const features = parseDbJson(rows[0].value) as Record<string, unknown> | null;
    if (features && typeof features.public_reviews === "boolean") return features.public_reviews;
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve a customer's current membership tier (name + badge color) from their
 * points balance, for snapshotting onto a review at submit time. Best-effort —
 * returns nulls on any failure so it never blocks a review.
 */
export async function resolveCustomerTierSnapshot(customerId: string): Promise<{ name: string | null; color: string | null }> {
  try {
    const balRows = await query<RowDataPacket[]>(
      "SELECT COALESCE(SUM(points), 0) AS total FROM customer_points WHERE customer_id = ?",
      [customerId]
    );
    const points = Number(balRows[0]?.total) || 0;
    const tierRows = await query<RowDataPacket[]>(
      "SELECT name, badge_color FROM membership_tiers WHERE is_active = 1 AND min_points <= ? AND max_points >= ? LIMIT 1",
      [points, points]
    );
    if (tierRows.length === 0) return { name: null, color: null };
    return { name: (tierRows[0].name as string) || null, color: (tierRows[0].badge_color as string) || null };
  } catch {
    return { name: null, color: null };
  }
}
