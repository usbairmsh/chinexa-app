import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// ─── Self-healing migration: FULLTEXT + B-tree indexes for fast product
// search, plus a lightweight search-log table that powers real "trending
// searches" instead of a hardcoded list. Idempotent — safe to call on every
// request; each check only runs the ALTER once per fresh database.
let done = false;

async function indexExists(table: string, indexName: string): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  return Number(rows[0]?.c) > 0;
}

async function ensureIndex(table: string, indexName: string, ddl: string) {
  if (await indexExists(table, indexName)) return;
  await execute(ddl);
}

/**
 * If ft_products_search already exists but doesn't cover every admin-entered
 * text field (e.g. it was created by an earlier version of this migration),
 * drop and recreate it with the full column set. FULLTEXT indexes can't be
 * widened via a plain ADD COLUMN-style ALTER — recreating is the standard way.
 */
async function ensureFulltextCoversAllColumns(table: string, indexName: string, columns: string[]) {
  const rows = await query<RowDataPacket[]>(
    `SELECT DISTINCT column_name FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  if (rows.length === 0) {
    await execute(`ALTER TABLE ${table} ADD FULLTEXT INDEX ${indexName} (${columns.join(", ")})`);
    return;
  }
  const existingCols = new Set(rows.map((r) => r.column_name as string));
  const missing = columns.filter((c) => !existingCols.has(c));
  if (missing.length === 0) return;
  await execute(`ALTER TABLE ${table} DROP INDEX ${indexName}`);
  await execute(`ALTER TABLE ${table} ADD FULLTEXT INDEX ${indexName} (${columns.join(", ")})`);
}

const SEARCHABLE_COLUMNS = [
  "name", "short_description", "description", "category_name", "subcategory",
  "brand_name", "sku", "ingredients", "how_to_use", "seo_title", "seo_description",
  "country_of_origin", "weight",
];

export async function ensureSearchIndexes() {
  if (done) return;
  try {
    // FULLTEXT covers free-text relevance search (MATCH...AGAINST) — replaces
    // the old 9-way LIKE '%term%' scan, which can't use any index at all.
    // Every admin-entered text field on the product is included, so a search
    // can match on how-to-use instructions, SEO fields, origin/weight, etc.,
    // not just name/description. JSON columns (tags/badges) aren't included —
    // FULLTEXT requires char-based columns; tags get a LIKE fallback instead.
    await ensureFulltextCoversAllColumns("products", "ft_products_search", SEARCHABLE_COLUMNS);

    // B-tree indexes for the filter/sort columns every product-list query
    // hits (category, brand, active flag, price sort, featured sort, newest
    // sort) — previously only the PK and two UNIQUE constraints existed.
    await ensureIndex("products", "idx_products_category", "ALTER TABLE products ADD INDEX idx_products_category (category_id)");
    await ensureIndex("products", "idx_products_brand", "ALTER TABLE products ADD INDEX idx_products_brand (brand_id)");
    await ensureIndex("products", "idx_products_active_featured", "ALTER TABLE products ADD INDEX idx_products_active_featured (is_active, is_featured, created_at)");
    await ensureIndex("products", "idx_products_price", "ALTER TABLE products ADD INDEX idx_products_price (price)");
    await ensureIndex("products", "idx_products_rating", "ALTER TABLE products ADD INDEX idx_products_rating (average_rating)");

    // Search-log table — every real search term gets logged (fire-and-forget,
    // never blocks the search response). Powers genuine "trending searches"
    // from actual customer behavior instead of a hardcoded array.
    await execute(
      `CREATE TABLE IF NOT EXISTS search_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        term VARCHAR(255) NOT NULL,
        result_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_search_logs_term_time (term, created_at),
        INDEX idx_search_logs_time (created_at)
      ) ENGINE=InnoDB`
    );

    done = true;
  } catch (err) {
    console.error("[ensureSearchIndexes] failed:", err);
  }
}
