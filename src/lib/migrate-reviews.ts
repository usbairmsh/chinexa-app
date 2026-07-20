import { execute, query } from "@/lib/db";
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
       WHERE table_schema = DATABASE() AND table_name = 'reviews' AND column_name IN ('images','order_id')`
    );
    const has = new Set(cols.map((r) => r.c as string));
    if (!has.has("images")) await execute("ALTER TABLE reviews ADD COLUMN images JSON");
    if (!has.has("order_id")) await execute("ALTER TABLE reviews ADD COLUMN order_id VARCHAR(50)");

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
