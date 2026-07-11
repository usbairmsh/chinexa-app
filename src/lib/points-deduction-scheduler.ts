import cron from "node-cron";
import { runPointsDeductionEngine } from "@/lib/points-deduction-engine";

let started = false;

/**
 * Starts the hourly points-deduction tick. This is the fallback/backup check
 * for every rule — including ones marked "instant" — in case an event was
 * somehow missed, and the only check at all for rule types that have no
 * discrete triggering event (inactivity, points expiry, low spend).
 */
export function startPointsDeductionScheduler(): void {
  if (started) return;
  started = true;

  cron.schedule("0 * * * *", () => {
    runPointsDeductionEngine("scheduled").catch((err) => {
      console.error("[points-deduction] scheduled run failed:", err);
    });
  });
}
