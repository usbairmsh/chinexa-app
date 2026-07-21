import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { bulkNotify } from "@/lib/notify";

// Inventory history + back-in-stock wishlist support. Idempotent + self-healing
// like the other migrate-*.ts helpers, so a fresh deploy doesn't need
// setup-db.sql re-run.
//
//  • stock_history — an append-only log of every stock ADDITION event: the
//    initial creation of a product/variant ("added") and every later restock
//    ("restock"). Keyed by product_id (+ optional variant identity), storing
//    the quantity added and the resulting stock level. Powers the stock-edit
//    slider's per-variant history and the "recently added/restocked"
//    (Exclusive) listing.
//  • products.last_restocked_at — denormalized MAX(restock date) so listings
//    can sort/filter by freshness without joining the history table.
//  • customer_wishlists — a SERVER-SIDE record of a logged-in customer
//    wishlisting an out-of-stock product, so we can notify them when it's back.
//    (The storefront wishlist is otherwise localStorage-only.)
//  • products.oos_wishlist_count — denormalized count of out-of-stock wishlist
//    adds, shown + sortable in the admin product list.
//
// Variant identity note: product edits DELETE+re-INSERT all variants, so
// product_variants.id is NOT stable across edits. stock_history therefore keys
// variant rows by (product_id, variant_sku) — the SKU survives a re-insert —
// with variant_name kept for display.
let done = false;

export async function ensureInventoryTables() {
  if (done) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS stock_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(50) NOT NULL,
        variant_sku VARCHAR(100) NULL,
        variant_name VARCHAR(255) NULL,
        event_type ENUM('added','restock','adjust') NOT NULL DEFAULT 'restock',
        quantity_change INT NOT NULL DEFAULT 0,
        resulting_stock INT NULL,
        note VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sh_product (product_id, created_at),
        INDEX idx_sh_variant (product_id, variant_sku)
      ) ENGINE=InnoDB
    `);

    await execute(`
      CREATE TABLE IF NOT EXISTS customer_wishlists (
        id VARCHAR(64) PRIMARY KEY,
        customer_id VARCHAR(50) NOT NULL,
        product_id VARCHAR(50) NOT NULL,
        -- TRUE while the item is awaiting a back-in-stock notification (added
        -- while out of stock); cleared once we've notified on restock.
        notify_on_restock TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_customer_product (customer_id, product_id),
        INDEX idx_cw_product (product_id, notify_on_restock)
      ) ENGINE=InnoDB
    `);

    // products.last_restocked_at + products.oos_wishlist_count
    const prodCols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products'
       AND column_name IN ('last_restocked_at','oos_wishlist_count')`
    );
    const has = new Set(prodCols.map((r) => r.c as string));
    if (!has.has("last_restocked_at")) {
      await execute("ALTER TABLE products ADD COLUMN last_restocked_at DATETIME NULL DEFAULT NULL");
    }
    if (!has.has("oos_wishlist_count")) {
      await execute("ALTER TABLE products ADD COLUMN oos_wishlist_count INT NOT NULL DEFAULT 0");
    }

    done = true;
  } catch (err) {
    // Leave done=false so a transient failure retries on the next request.
    console.error("[ensureInventoryTables] migration failed:", err);
  }
}

interface StockHistoryEntry {
  productId: string;
  variantSku?: string | null;
  variantName?: string | null;
  eventType: "added" | "restock" | "adjust";
  quantityChange: number;
  resultingStock?: number | null;
  note?: string | null;
  /** When true (a restock/added with positive qty), also bump products.last_restocked_at. */
  bumpRestockedAt?: boolean;
}

/**
 * Append a stock-history row. Best-effort: history logging must never break the
 * actual stock write, so failures are swallowed (logged). Callers should await
 * it inside their own try/catch-free flow — it self-contains its errors.
 */
export async function recordStockHistory(entry: StockHistoryEntry): Promise<void> {
  try {
    await ensureInventoryTables();
    await execute(
      `INSERT INTO stock_history (product_id, variant_sku, variant_name, event_type, quantity_change, resulting_stock, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.productId,
        entry.variantSku ?? null,
        entry.variantName ?? null,
        entry.eventType,
        entry.quantityChange,
        entry.resultingStock ?? null,
        entry.note ?? null,
      ]
    );
    if (entry.bumpRestockedAt && entry.quantityChange > 0) {
      await execute("UPDATE products SET last_restocked_at = NOW() WHERE id = ?", [entry.productId]);
    }
  } catch (err) {
    console.error("[recordStockHistory] failed:", err);
  }
}

/**
 * Called after a product's stock rises above 0. Notifies every logged-in
 * customer who wishlisted it while it was out of stock (notify_on_restock = 1),
 * then clears their flags so they're only told once per restock cycle.
 * Best-effort; never throws into the caller's stock-write path.
 *
 * Also resets products.oos_wishlist_count to 0 — the "how many people are
 * waiting" number is only meaningful while the item is out of stock, and those
 * waiters have now been notified.
 */
export async function notifyBackInStock(productId: string): Promise<void> {
  try {
    await ensureInventoryTables();
    const waiters = await query<RowDataPacket[]>(
      "SELECT customer_id FROM customer_wishlists WHERE product_id = ? AND notify_on_restock = 1",
      [productId]
    );
    const customerIds = waiters.map((r) => r.customer_id as string);
    if (customerIds.length > 0) {
      const prod = await query<RowDataPacket[]>("SELECT name, slug FROM products WHERE id = ? LIMIT 1", [productId]);
      const name = (prod[0]?.name as string) || "An item on your wishlist";
      const slug = (prod[0]?.slug as string) || "";
      await bulkNotify(customerIds, {
        type: "system",
        title: "Back in stock!",
        message: `${name} is available again. Grab it before it sells out.`,
        link: slug ? `/products/${slug}` : "/wishlist",
      });
      await execute(
        "UPDATE customer_wishlists SET notify_on_restock = 0 WHERE product_id = ? AND notify_on_restock = 1",
        [productId]
      );
    }
    // The waiting-count is stale once restocked — zero it out.
    await execute("UPDATE products SET oos_wishlist_count = 0 WHERE id = ?", [productId]);
  } catch (err) {
    console.error("[notifyBackInStock] failed:", err);
  }
}

/**
 * Helper for stock write-sites: given the stock level BEFORE and AFTER a write,
 * fire the back-in-stock fan-out only on a genuine 0 → positive transition.
 */
export async function handleRestockTransition(productId: string, before: number, after: number): Promise<void> {
  if (before <= 0 && after > 0) {
    await notifyBackInStock(productId);
  }
}
