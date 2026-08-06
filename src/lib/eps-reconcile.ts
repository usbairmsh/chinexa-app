import cron from "node-cron";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { isEpsConfigured } from "@/lib/eps";
import { ensureEpsTables } from "@/lib/migrate-eps";
import { settleEpsOrder, expireEpsOrder, PAYMENT_WINDOW_MINUTES } from "@/lib/eps-settle";

// ─── EPS reconciliation + payment-window expiry ───────────────────────────────
// Runs on a timer and does two things, IN THIS ORDER:
//
//   1. Reconcile — for every unpaid EPS order, ask EPS whether it was actually
//      paid. This recovers payments where the customer paid but never made it
//      back to the site (closed tab, lost connection, phone died), which would
//      otherwise leave money taken and the order stuck as unpaid.
//
//   2. Expire — only orders that reconciliation confirmed are still unpaid, and
//      whose payment window has closed, get cancelled with their stock released.
//
// The order matters: reconciling first guarantees a genuinely-paid order is
// never cancelled out from under a customer.

/** Look back this far for unpaid orders — beyond it, an order is long dead. */
const LOOKBACK_HOURS = 48;

export interface ReconcileSummary {
  checked: number;
  settled: number;
  expired: number;
  errors: number;
}

export async function runEpsReconcile(trigger: "scheduled" | "manual" = "scheduled"): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { checked: 0, settled: 0, expired: 0, errors: 0 };
  if (!isEpsConfigured()) return summary;

  try {
    await ensureEpsTables();

    // Unpaid EPS orders still in a payable state, within the lookback window.
    // age_minutes comes from the DB so the window check is immune to any
    // timezone difference between MySQL and the app container.
    const rows = await query<RowDataPacket[]>(
      `SELECT id, TIMESTAMPDIFF(MINUTE, created_at, NOW()) AS age_minutes FROM orders
       WHERE payment_method = 'EPS'
         AND payment_status IN ('pending','failed')
         AND status NOT IN ('cancelled','returned','received','not_received')
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
       ORDER BY created_at ASC
       LIMIT 200`,
      [LOOKBACK_HOURS]
    );

    for (const row of rows) {
      const orderId = String(row.id);
      summary.checked++;
      try {
        // 1) Did they actually pay?
        const settle = await settleEpsOrder(orderId);
        if (settle.settled) {
          summary.settled++;
          continue;
        }
        // 2) Still unpaid — expire it if the window has closed.
        if (Number(row.age_minutes) >= PAYMENT_WINDOW_MINUTES) {
          if (await expireEpsOrder(orderId)) summary.expired++;
        }
      } catch (err) {
        summary.errors++;
        console.error(`[eps-reconcile] order ${orderId} failed:`, err);
      }
    }

    if (summary.settled || summary.expired || summary.errors) {
      console.log(
        `[eps-reconcile] (${trigger}) checked=${summary.checked} settled=${summary.settled} expired=${summary.expired} errors=${summary.errors}`
      );
    }
  } catch (err) {
    summary.errors++;
    console.error("[eps-reconcile] run failed:", err);
  }
  return summary;
}

let started = false;

/**
 * Starts the EPS reconcile/expiry tick (every 5 minutes). Frequent enough that a
 * paid-but-not-returned order is confirmed quickly, and that stock from an
 * abandoned order is released soon after its window closes.
 */
export function startEpsReconcileScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule("*/5 * * * *", () => {
    runEpsReconcile("scheduled").catch((err) => {
      console.error("[eps-reconcile] scheduled run failed:", err);
    });
  });
}
