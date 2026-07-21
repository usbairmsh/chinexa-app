import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { parseDbJson } from "@/lib/db";

// Pre-order support columns + status/enum extensions. Idempotent + self-healing
// like the other migrate-*.ts helpers, so a fresh deploy doesn't need
// setup-db.sql re-run. Pre-orders are COD-only reservations: a customer can
// order an out-of-stock, `preorder`-badged product; no money is taken up front,
// no stock is deducted until an admin fulfils it.
//
//  • products.preorder_release_date — optional "expected availability" date the
//    admin sets, shown to the customer. Purely informational; the badge (not
//    this date) is what makes a product pre-orderable.
//  • orders.is_preorder / orders.preorder_expected_date — flags a placed order
//    as a pre-order + snapshots the expected date at order time.
//  • order_items.is_preorder — flags the specific line.
//  • orders.status ENUM gains 'preorder' (front of the lifecycle, before
//    'pending') so a reserved-but-unfulfilled order has its own state.
let done = false;

export async function ensurePreorderColumns() {
  if (done) return;
  try {
    // products.preorder_release_date
    const prodCols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products'
       AND column_name = 'preorder_release_date'`
    );
    if (prodCols.length === 0) {
      await execute("ALTER TABLE products ADD COLUMN preorder_release_date DATE NULL DEFAULT NULL");
    }

    // orders.is_preorder + orders.preorder_expected_date
    const orderCols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'
       AND column_name IN ('is_preorder','preorder_expected_date')`
    );
    const hasOrderCol = new Set(orderCols.map((r) => r.c as string));
    if (!hasOrderCol.has("is_preorder")) {
      await execute("ALTER TABLE orders ADD COLUMN is_preorder TINYINT(1) NOT NULL DEFAULT 0");
    }
    if (!hasOrderCol.has("preorder_expected_date")) {
      await execute("ALTER TABLE orders ADD COLUMN preorder_expected_date DATE NULL DEFAULT NULL");
    }

    // orders.status ENUM must include 'preorder'
    const statusCol = await query<RowDataPacket[]>(
      `SELECT COLUMN_TYPE AS t FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'status'`
    );
    const statusType = (statusCol[0]?.t as string) || "";
    if (!statusType.includes("'preorder'")) {
      await execute(
        "ALTER TABLE orders MODIFY COLUMN status ENUM('preorder','pending','confirmed','processing','shipped','on_delivery','received','not_received','returned','cancelled') DEFAULT 'pending'"
      );
    }

    // order_items.is_preorder
    const itemCols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'order_items'
       AND column_name = 'is_preorder'`
    );
    if (itemCols.length === 0) {
      await execute("ALTER TABLE order_items ADD COLUMN is_preorder TINYINT(1) NOT NULL DEFAULT 0");
    }

    done = true;
  } catch (err) {
    // Leave done=false so a transient failure retries on the next request.
    console.error("[ensurePreorderColumns] migration failed:", err);
  }
}

/**
 * Server-side read of the store's `preorders` feature toggle (stored under the
 * `features` settings key, alongside product_reviews/wishlist/etc). Defaults to
 * TRUE when unset, matching the admin UI's default. When off, the pre-order
 * flow is disabled everywhere: out-of-stock badged products behave as plain
 * out-of-stock (wishlist-only), and the order route rejects pre-order lines.
 */
export async function preordersEnabled(): Promise<boolean> {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT value FROM settings WHERE `key` = 'features' LIMIT 1"
    );
    if (rows.length === 0) return true;
    const features = parseDbJson(rows[0].value) as Record<string, unknown> | null;
    if (features && typeof features.preorders === "boolean") return features.preorders;
    return true;
  } catch {
    return true;
  }
}
