// Runs once when the Next.js server process starts (Node.js runtime only —
// this app has no Edge routes that need instrumentation). Used here to start
// an in-process interval that periodically runs the points-deduction rule
// engine, so it fires automatically with zero server/cron setup — no
// crontab entry, no secret, nothing to configure outside the admin UI.
//
// Tradeoff: this only runs while the Node process itself stays alive. If the
// app restarts (deploy, crash, VPS reboot) the interval restarts too, but
// since it's periodic it just resumes on the next tick — no manual step
// needed either way.
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runPointsDeductionEngine } = await import("@/lib/points-deduction-engine");

  const tick = async () => {
    try {
      const summary = await runPointsDeductionEngine();
      if (summary.rulesEvaluated > 0) {
        console.log(
          `[points-deduction] auto-run: ${summary.rulesEvaluated} rule(s), ` +
          `${summary.customersAffected} customer(s) affected, ${summary.totalPointsDeducted} points deducted`
        );
      }
    } catch (err) {
      console.error("[points-deduction] auto-run failed:", err);
    }
  };

  // Run once shortly after boot (so a newly saved rule doesn't wait a full
  // hour for its first evaluation), then on the regular interval. The
  // engine's own per-rule cooldown already prevents double-firing on the
  // same customer if the server restarts frequently.
  setTimeout(tick, 30 * 1000);
  setInterval(tick, CHECK_INTERVAL_MS);
}
