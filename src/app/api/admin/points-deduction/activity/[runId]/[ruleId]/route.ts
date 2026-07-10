import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";

export const dynamic = "force-dynamic";

// GET /api/admin/points-deduction/activity/[runId]/[ruleId] — the list of
// customers a single rule matched during a single run, with the matched
// criteria and current reversal/disbursement state.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string; ruleId: string }> }) {
  try {
    await ensurePromotionColumns();
    const { runId, ruleId } = await params;

    const rows = await query<RowDataPacket[]>(
      `SELECT prc.id, prc.run_id, prc.rule_id, prc.rule_name, prc.rule_type, prc.customer_id,
              prc.outcome, prc.points_deducted, prc.matched_criteria, prc.error_message,
              prc.created_at, prc.reversed_at, prc.disbursed_at,
              c.name AS customer_name, c.phone AS customer_phone
       FROM points_deduction_run_customers prc
       LEFT JOIN customers c ON c.id = prc.customer_id
       WHERE prc.run_id = ? AND prc.rule_id = ?
       ORDER BY prc.outcome = 'deducted' DESC, prc.created_at ASC`,
      [runId, ruleId]
    );

    const customers = rows.map((r) => ({
      id: r.id as string,
      runId: r.run_id as string,
      ruleId: r.rule_id as string,
      ruleName: r.rule_name as string,
      ruleType: r.rule_type as string,
      customerId: r.customer_id as string,
      customerName: (r.customer_name as string) || "Unknown customer",
      customerPhone: (r.customer_phone as string) || "",
      outcome: r.outcome as string,
      pointsDeducted: Number(r.points_deducted) || 0,
      matchedCriteria: (r.matched_criteria as string) || "",
      errorMessage: r.error_message as string | null,
      createdAt: r.created_at as string,
      reversedAt: r.reversed_at as string | null,
      disbursedAt: r.disbursed_at as string | null,
    }));

    return NextResponse.json({ customers });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
