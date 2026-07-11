// Runs once when the Next.js server process starts (Node.js runtime only —
// this app has no Edge routes that need instrumentation). Starts the
// points-deduction hourly cron tick so it runs automatically with zero
// manual server/cron setup.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPointsDeductionScheduler } = await import("@/lib/points-deduction-scheduler");
  startPointsDeductionScheduler();
}
