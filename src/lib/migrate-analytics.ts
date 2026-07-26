import { execute } from "@/lib/db";

// Self-hosted page-view tracking for the admin dashboard's Traffic &
// Conversions chart. One row per storefront page view, written by the
// fire-and-forget /api/track beacon. Deliberately lightweight:
//   - visitor_id is a privacy-safe daily hash (IP+UA+date+salt), never raw PII,
//     so distinct visitors/day can be counted without storing who they are.
//   - session_id groups views within a short window (also a hash).
//   - is_bot lets the query exclude obvious crawler traffic from the counts.
// created_at is indexed because every read is a "last N days" range scan.
let migrated = false;
export async function ensurePageViewsTable() {
  if (migrated) return;
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS page_views (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        path VARCHAR(512) NOT NULL,
        visitor_id CHAR(32) NOT NULL,
        session_id CHAR(32) NOT NULL,
        is_bot BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_page_views_created (created_at),
        INDEX idx_page_views_visitor_day (visitor_id, created_at)
      ) ENGINE=InnoDB
    `);
    migrated = true;
  } catch (err) {
    console.error("[ensurePageViewsTable] migration failed:", err);
  }
}
