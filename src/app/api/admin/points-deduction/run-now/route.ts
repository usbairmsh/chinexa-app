import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { runPointsDeductionEngine } from "@/lib/points-deduction-engine";

export const dynamic = "force-dynamic";

// GET /api/admin/points-deduction/run-now — recent run history (scheduled,
// manual, and instant runs alike), so the admin UI can show whether the
// engine is actually firing.
export async function GET() {
  try {
    const rows = await query<RowDataPacket[]>(
      `SELECT id, started_at, finished_at, trigger_source, rules_evaluated, customers_affected, total_points_deducted, summary
       FROM points_deduction_runs ORDER BY started_at DESC LIMIT 20`
    );
    const runs = rows.map((r) => {
      let summary: unknown = null;
      try { summary = typeof r.summary === "string" ? JSON.parse(r.summary) : r.summary; } catch { /* leave null */ }
      return {
        runId: r.id as string,
        triggerSource: r.trigger_source as string,
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

// POST /api/admin/points-deduction/run-now — lets an admin trigger a full
// rule evaluation immediately, instead of waiting for the next hourly tick.
//
// Note: like every other /api/admin/* route in this codebase, this has no
// server-side session check — the admin panel's client-side layout is what
// gates access today, not the API layer itself.
export async function POST() {
  try {
    const summary = await runPointsDeductionEngine("manual");
    return NextResponse.json({ success: true, ...summary });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
