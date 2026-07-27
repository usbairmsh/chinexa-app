import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// ─── Auto-migration for the return/refund/exchange workflow ───
// Brings an existing `order_returns` table up to the per-item + refund/exchange
// lifecycle schema. Idempotent; only latches "done" once confirmed applied so a
// transient failure retries later. Mirrors the ensure* pattern in
// migrate-promotions.ts.
let done = false;

async function columnType(table: string, column: string): Promise<string | null> {
  const rows = await query<RowDataPacket[]>(
    `SELECT COLUMN_TYPE AS type FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows.length ? String(rows[0].type) : null;
}

async function ensureColumn(table: string, column: string, definition: string) {
  if (await columnType(table, column)) return;
  await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

const RETURN_STATUSES = [
  "requested", "approved", "pickup_scheduled", "received", "rejected",
  "refund_in_progress", "refunded",
  "exchange_in_progress", "exchange_shipped", "exchange_delivered",
];

export async function ensureReturnColumns() {
  if (done) return;
  try {
    // reason: was a fixed ENUM('damaged',...) — widen to a VARCHAR code from the
    // admin-configurable Return Reasons list. MODIFY is safe (existing enum
    // values are all valid short strings that fit VARCHAR(60)).
    const reasonType = await columnType("order_returns", "reason");
    if (reasonType && reasonType.toLowerCase().startsWith("enum")) {
      await execute("ALTER TABLE order_returns MODIFY COLUMN reason VARCHAR(60) NOT NULL");
    }
    await ensureColumn("order_returns", "reason_label", "VARCHAR(120)");

    // status: widen the enum to the full lifecycle.
    const statusType = await columnType("order_returns", "status");
    if (statusType) {
      const missing = RETURN_STATUSES.filter((s) => !statusType.includes(`'${s}'`));
      if (missing.length > 0) {
        const enumList = RETURN_STATUSES.map((s) => `'${s}'`).join(",");
        await execute(`ALTER TABLE order_returns MODIFY COLUMN status ENUM(${enumList}) DEFAULT 'requested'`);
      }
    }

    await ensureColumn("order_returns", "images", "JSON");
    await ensureColumn("order_returns", "resolution", "ENUM('refund','exchange') NULL");
    await ensureColumn("order_returns", "reversals_applied", "BOOLEAN NOT NULL DEFAULT FALSE");
    await ensureColumn("order_returns", "refunded_at", "TIMESTAMP NULL DEFAULT NULL");
    await ensureColumn("order_returns", "exchange_shipped_at", "TIMESTAMP NULL DEFAULT NULL");

    done = true;
  } catch (err) {
    console.error("[ensureReturnColumns] migration failed:", err);
  }
}
