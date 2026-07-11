import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";

export const dynamic = "force-dynamic";

// GET /api/admin/points-deduction/activity — Engine Activity Log: which
// rules ran (scheduled, manual, or instant) and their outcome, most recent
// first. Grouped by (run, rule) since a single run can evaluate multiple
// enabled rules.
export async function GET(req: NextRequest) {
  try {
    // See points-deduction/route.ts — this query joins on trigger_source
    // directly and must not assume an engine run has already migrated it.
    await ensurePromotionColumns();
    const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 50));

    // LEFT JOIN, not INNER — a customer row whose parent run record failed to
    // write (e.g. a transient error) should still show up here instead of
    // silently vanishing just because points_deduction_runs has no match.
    const rows = await query<RowDataPacket[]>(
      `SELECT prc.run_id, prc.rule_id, prc.rule_name, prc.rule_type,
              pr.trigger_source,
              MIN(prc.created_at) AS ran_at,
              COUNT(*) AS candidates,
              SUM(prc.outcome = 'deducted') AS customers_affected,
              SUM(prc.outcome = 'error') AS error_count,
              SUM(CASE WHEN prc.outcome = 'deducted' THEN prc.points_deducted ELSE 0 END) AS points_deducted
       FROM points_deduction_run_customers prc
       LEFT JOIN points_deduction_runs pr ON pr.id = prc.run_id
       GROUP BY prc.run_id, prc.rule_id, prc.rule_name, prc.rule_type, pr.trigger_source
       ORDER BY ran_at DESC
       LIMIT ${limit}`
    );

    const entries = rows.map((r) => ({
      runId: r.run_id as string,
      ruleId: r.rule_id as string,
      ruleName: r.rule_name as string,
      ruleType: r.rule_type as string,
      triggerSource: (r.trigger_source as string) || "scheduled",
      ranAt: r.ran_at as string,
      candidates: Number(r.candidates) || 0,
      customersAffected: Number(r.customers_affected) || 0,
      errorCount: Number(r.error_count) || 0,
      pointsDeducted: Number(r.points_deducted) || 0,
    }));

    return NextResponse.json({ entries });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
