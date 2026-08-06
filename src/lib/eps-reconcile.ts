import cron from "node-cron";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { isEpsConfigured } from "@/lib/eps";
import { ensureEpsTables } from "@/lib/migrate-eps";
import { ensurePaymentLinkTables } from "@/lib/migrate-payment-links";
import { expireStalePaymentLinks, reconcileStandaloneLinks } from "@/lib/payment-links";
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

/**
 * Look back this far for unpaid orders — beyond it, a normal checkout order is
 * long dead (its window is only 60 minutes).
 *
 * An order carrying an admin-issued payment link is NOT covered by this alone:
 * a link may live for days, and the customer can pay on the last day. If such an
 * order fell out of this window, a payment whose browser never returned would
 * never be reconciled — EPS would hold the money while the order stayed unpaid,
 * and the still-payable link would invite a second charge. The query therefore
 * also matches any order with a recent link, regardless of the order's own age.
 */
const LOOKBACK_HOURS = 48;

/** How far back to keep checking orders that have (or had) a payment link. */
const LINK_LOOKBACK_HOURS = 24 * 45;

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
    // The reconcile query joins against payment_links, so the table must exist
    // even on a deployment that has never issued a link.
    await ensurePaymentLinkTables();
    // Bookkeeping: flip lapsed links to 'expired' so the admin list is accurate
    // and their orders become eligible for normal expiry on the next tick.
    await expireStalePaymentLinks();
    // Standalone links have no order row, so the order loop below can't see
    // them. They need the same recovery: without it, a payment whose browser
    // never returned would leave EPS holding the money while the link still
    // read unpaid and stayed payable, inviting a second charge.
    const standalone = await reconcileStandaloneLinks();
    summary.checked += standalone.checked;
    summary.settled += standalone.settled;

    // Unpaid EPS orders still in a payable state, within the lookback window.
    // age_minutes comes from the DB so the window check is immune to any
    // timezone difference between MySQL and the app container.
    // has_live_link: an order with an admin-issued payment link that is still
    // active and unexpired must NOT be expired on the 60-minute checkout clock —
    // the link carries its own, much longer deadline. Without this, every link
    // an admin sends would have its order cancelled (and stock restored) an hour
    // later, while the customer still holds a link that looks valid.
    const rows = await query<RowDataPacket[]>(
      `SELECT o.id, TIMESTAMPDIFF(MINUTE, o.created_at, NOW()) AS age_minutes,
              EXISTS (
                SELECT 1 FROM payment_links pl
                 WHERE pl.order_id = o.id AND pl.status = 'active' AND pl.expires_at > NOW()
              ) AS has_live_link
         FROM orders o
       WHERE o.payment_method = 'EPS'
         AND o.payment_status IN ('pending','failed')
         AND o.status NOT IN ('cancelled','returned','received','not_received')
         AND (
               o.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
               OR EXISTS (
                 SELECT 1 FROM payment_links pl2
                  WHERE pl2.order_id = o.id
                    AND pl2.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
               )
             )
       ORDER BY o.created_at ASC
       LIMIT 200`,
      [LOOKBACK_HOURS, LINK_LOOKBACK_HOURS]
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
        // 2) Still unpaid — expire it if the window has closed. An order held
        //    open by a live payment link is skipped; it is expired later, once
        //    that link lapses and has_live_link goes false.
        if (Number(row.has_live_link) !== 1 && Number(row.age_minutes) >= PAYMENT_WINDOW_MINUTES) {
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
