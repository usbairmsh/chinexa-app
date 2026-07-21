import { execute, query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// Retention + query support for the activity log:
//  • an index on created_at so the date-range filter and the purge below stay
//    fast as the log grows,
//  • a rolling 1-month retention purge (anything older than 30 days is deleted).
// The purge is throttled to once per hour per process so it doesn't run on
// every single log read.

let indexEnsured = false;
async function ensureIndex() {
  if (indexEnsured) return;
  try {
    const idx = await query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'activity_log' AND index_name = 'idx_activity_created'`
    );
    if (Number(idx[0]?.c) === 0) {
      await execute("CREATE INDEX idx_activity_created ON activity_log (created_at)");
    }
    indexEnsured = true;
  } catch (err) {
    console.error("[migrate-activity-log] index failed:", err);
  }
}

let lastPurge = 0;
const PURGE_INTERVAL_MS = 60 * 60 * 1000; // at most once an hour per process

/** Delete activity older than 30 days. Safe to call often — self-throttled. */
export async function purgeOldActivity(force = false) {
  await ensureIndex();
  // Date.now() is fine at request time (this is not a Workflow script).
  const now = Date.now();
  if (!force && now - lastPurge < PURGE_INTERVAL_MS) return;
  lastPurge = now;
  try {
    await execute("DELETE FROM activity_log WHERE created_at < (NOW() - INTERVAL 30 DAY)");
    // Also drop historical login / self-profile-edit rows that used to be
    // written before those stopped being logged — one-time cleanup, cheap
    // once the rows are gone.
    await execute("DELETE FROM activity_log WHERE action IN ('Admin logged in', 'Updated admin profile')");
  } catch (err) {
    console.error("[migrate-activity-log] purge failed:", err);
  }
}
