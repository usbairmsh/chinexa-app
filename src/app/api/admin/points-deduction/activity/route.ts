import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";

export const dynamic = "force-dynamic";

// GET /api/admin/points-deduction/activity — Engine Activity Log: list of
// rules that ran automatically (or manually via Run Now), most recent first.
// Each row here is one (run, rule) pair — the run-level record already exists
// in points_deduction_runs, but this groups by rule too so the log reads as
// "which rules ran" rather than "which runs happened" (a run can contain
// multiple enabled rules).
export async function GET(req: NextRequest) {
  try {
    await ensurePromotionColumns();
    const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 50));

    const rows = await query<RowDataPacket[]>(
      `SELECT run_id, rule_id, rule_name, rule_type,
              MIN(created_at) AS ran_at,
              COUNT(*) AS candidates,
              SUM(outcome = 'deducted') AS customers_affected,
              SUM(outcome = 'error') AS error_count,
              SUM(CASE WHEN outcome = 'deducted' THEN points_deducted ELSE 0 END) AS points_deducted
       FROM points_deduction_run_customers
       GROUP BY run_id, rule_id, rule_name, rule_type
       ORDER BY ran_at DESC
       LIMIT ${limit}`
    );

    const entries = rows.map((r) => ({
      runId: r.run_id as string,
      ruleId: r.rule_id as string,
      ruleName: r.rule_name as string,
      ruleType: r.rule_type as string,
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
