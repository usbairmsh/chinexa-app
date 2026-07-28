import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// Adds the SEO keywords column the blog editor's hidden keywords box writes to.
// Self-healing (idempotent), same pattern as the other migrate-* helpers.
let migrated = false;

export async function ensureBlogSeoColumns() {
  if (migrated) return;
  try {
    const cols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'blog_posts' AND column_name IN ('seo_keywords')`
    );
    const has = new Set(cols.map((r) => r.c as string));
    if (!has.has("seo_keywords")) {
      await execute("ALTER TABLE blog_posts ADD COLUMN seo_keywords VARCHAR(500) NULL DEFAULT NULL");
    }
    migrated = true;
  } catch (err) {
    console.error("[ensureBlogSeoColumns] migration failed:", err);
  }
}
