import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// Per-tag "hide on card" support. A product's `badges` array is unchanged — it
// still drives every section/filter (Trending, Exclusive, New, …) and the
// pre-order logic, all of which key off a tag being PRESENT. This companion
// column, `hidden_card_badges`, lists the subset of those badges that should
// NOT render a chip on the compact product card (they still show on the detail
// page and still list the product in their section). Stored as a JSON string
// array, exactly like `badges`.
//
// Idempotent + self-healing like the other migrate-*.ts helpers.
let done = false;

export async function ensureCardBadgeColumn() {
  if (done) return;
  try {
    const cols = await query<RowDataPacket[]>(
      `SELECT column_name AS c FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products'
       AND column_name = 'hidden_card_badges'`
    );
    if (cols.length === 0) {
      await execute("ALTER TABLE products ADD COLUMN hidden_card_badges JSON NULL DEFAULT NULL");
    }
    done = true;
  } catch (err) {
    // Leave done=false so a transient failure retries on the next request.
    console.error("[ensureCardBadgeColumn] migration failed:", err);
  }
}
