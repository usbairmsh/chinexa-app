import { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { execute } from "@/lib/db";

// ─── Sequential order numbers ─────────────────────────────────────────────────
// Format: ORD-26-000001 — "26" is the two-digit year, "000001" a 6-digit
// sequence that RESTARTS AT 1 EACH YEAR. Embedding the year is only meaningful
// if the sequence resets; otherwise the year would be decoration on a number
// that keeps climbing. So the counter is per-year: one row per year, named
// `order_number:<yy>`.
//
// Consequence worth knowing: the sequence alone is not unique across years
// (ORD-25-000001 and ORD-26-000001 both exist), but the full string is, which is
// what the UNIQUE constraint covers.
//
// Why a counter table and not MAX(order_number)+1: two orders placed at the same
// moment would both read the same MAX and try to insert the same number, and
// orders.order_number is UNIQUE — so one customer's checkout would hard-fail.
// A row-locked counter serialises allocation instead.
//
// Why not AUTO_INCREMENT on a column: the number must be allocated inside the
// same transaction as the order insert, so that a rolled-back order (out of
// stock, payment setup failure) does not consume a number. Reserving from a
// locked counter row gives us that; an AUTO_INCREMENT would burn the value even
// on rollback, leaving visible gaps in what customers perceive as a sequence.
//
// This replaces `ORD-${Date.now().slice(-6)}`, which was not sequential AND
// collided whenever two orders shared a millisecond mod 1,000,000 — the UNIQUE
// constraint turned that collision into a failed checkout.

export const ORDER_NUMBER_PREFIX = "ORD-";
const PAD = 6;

/** Two-digit year, e.g. 2026 -> "26". */
export function currentYear2(d: Date = new Date()): string {
  return String(d.getFullYear() % 100).padStart(2, "0");
}

// Keyed by year, not a bare boolean: a long-running container that crosses into
// a new year must re-seed for that year rather than skip it as "already done".
let ensuredYear = "";

/** Idempotent: creates the counter table and seeds this year past any existing orders. */
export async function ensureOrderCounter(): Promise<void> {
  if (ensuredYear === currentYear2()) return;
  await execute(
    `CREATE TABLE IF NOT EXISTS counters (
      name VARCHAR(50) PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`
  );
  // Seed THIS year's counter at the highest number already issued for this year,
  // so a database that already has orders continues its sequence instead of
  // restarting at 1 and colliding.
  //
  // The LIKE is anchored to this year's prefix ('ORD-26-%'), so legacy
  // `ORD-123456` numbers can't be misread: they have no second dash and would
  // otherwise parse as a huge sequence value and push the counter into nonsense.
  const yy = currentYear2();
  await execute(
    `INSERT INTO counters (name, value)
     SELECT ?, COALESCE(MAX(CAST(SUBSTRING(order_number, ?) AS UNSIGNED)), 0)
       FROM orders WHERE order_number LIKE ?
     ON DUPLICATE KEY UPDATE value = value`,
    [counterName(yy), yearPrefix(yy).length + 1, `${yearPrefix(yy)}%`]
  );
  ensuredYear = yy;
}

/** e.g. "ORD-26-" */
function yearPrefix(yy: string): string {
  return `${ORDER_NUMBER_PREFIX}${yy}-`;
}

function counterName(yy: string): string {
  return `order_number:${yy}`;
}

/** Build a full order number from a year and sequence, e.g. (26, 1) -> ORD-26-000001. */
export function formatOrderNumber(n: number, yy: string = currentYear2()): string {
  return `${yearPrefix(yy)}${String(n).padStart(PAD, "0")}`;
}

/**
 * Reserve the next order number, inside the caller's transaction.
 *
 * `UPDATE ... SET value = value + 1` takes a row lock held until the caller
 * commits, so concurrent checkouts queue rather than racing. If the caller rolls
 * back, the increment rolls back with it and the number is not consumed.
 *
 * Must be called with a connection that is already in a transaction — passing a
 * pooled connection would release the lock immediately and reintroduce the race.
 */
export async function nextOrderNumber(conn: PoolConnection): Promise<string> {
  // The year is read HERE, per call, not cached at module load — a container
  // running across midnight on 31 December must roll to the new year's counter
  // rather than keep issuing last year's numbers.
  const yy = currentYear2();
  const name = counterName(yy);

  // Materialise the row first: on 1 January this year's row doesn't exist yet,
  // and the UPDATE below would match nothing.
  await conn.execute(
    "INSERT INTO counters (name, value) VALUES (?, 0) ON DUPLICATE KEY UPDATE value = value",
    [name]
  );
  // The UPDATE takes the row lock. It must come BEFORE the read: under
  // REPEATABLE READ a SELECT-then-UPDATE would hand two concurrent transactions
  // the same snapshot value, and both would try to insert the same number.
  await conn.execute("UPDATE counters SET value = value + 1 WHERE name = ?", [name]);
  const [rows] = await conn.execute<RowDataPacket[]>(
    "SELECT value FROM counters WHERE name = ?",
    [name]
  );
  const n = Number(rows[0]?.value);
  // No `|| 1` fallback: silently returning 1 on an unexpected empty read would
  // mint a duplicate of the year's first order and fail the insert with a
  // confusing unique-key error. Fail loudly instead.
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Could not reserve an order number for ${yy}`);
  }
  return formatOrderNumber(n, yy);
}
