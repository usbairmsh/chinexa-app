import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { runPointsDeductionEngine } from "@/lib/points-deduction-engine";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";

export const dynamic = "force-dynamic";

// GET /api/admin/points-deduction/run-now — recent run history, so the admin
// UI can show whether the automatic hourly scheduler is actually firing
// (instead of a rule silently never running with no visible signal either way).
export async function GET() {
  try {
    await ensurePromotionColumns();
    const rows = await query<RowDataPacket[]>(
      `SELECT id, started_at, finished_at, rules_evaluated, customers_affected, total_points_deducted, summary
       FROM points_deduction_runs ORDER BY started_at DESC LIMIT 10`
    );
    const runs = rows.map((r) => {
      let summary: unknown = null;
      try { summary = typeof r.summary === "string" ? JSON.parse(r.summary) : r.summary; } catch { /* leave null */ }
      return {
        id: r.id as string,
        startedAt: r.started_at as string,
        finishedAt: r.finished_at as string | null,
        rulesEvaluated: Number(r.rules_evaluated) || 0,
        customersAffected: Number(r.customers_affected) || 0,
        totalPointsDeducted: Number(r.total_points_deducted) || 0,
        summary,
      };
    });
    return NextResponse.json({ runs });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}

// POST /api/admin/points-deduction/run-now — lets an admin trigger a rule
// evaluation immediately from the admin UI, instead of waiting for the next
// cron tick, to see the effect of a rule right after saving it.
//
// Note: like every other /api/admin/* route in this codebase, this has no
// server-side session check — the admin panel's client-side layout is what
// gates access today, not the API layer itself. Anyone who can reach this
// URL directly can trigger a real run. This matches the existing codebase
// convention rather than introducing new risk, but is worth real
// authentication (e.g. a checked admin session cookie) before this app
// handles anything more sensitive than it already does.
export async function POST() {
  try {
    const summary = await runPointsDeductionEngine();
    return NextResponse.json({ success: true, ...summary });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
