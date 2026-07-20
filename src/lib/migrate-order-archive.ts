import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// Adds the two columns the Active/Archived order tabs need. Shared between
// /api/orders (list + counts) and /api/orders/[id] (the archive toggle) since
// either one could be the first request to hit a fresh deploy.
let migrated = false;
export async function ensureOrderArchiveColumns() {
  if (migrated) return;
  try {
    const cols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name IN ('is_archived','archived_at')`
    );
    const has = new Set(cols.map((r) => r.c as string));
    if (!has.has("is_archived")) await execute("ALTER TABLE orders ADD COLUMN is_archived BOOLEAN DEFAULT FALSE");
    if (!has.has("archived_at")) await execute("ALTER TABLE orders ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL");
    migrated = true;
  } catch (err) {
    console.error("[ensureOrderArchiveColumns] migration failed:", err);
  }
}
