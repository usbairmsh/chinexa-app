import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { notifyTierUpgrade, bulkNotify } from "@/lib/notify";
import { insertCustomerPoints } from "@/lib/points";
import { validationError, dependencyError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";

export const dynamic = "force-dynamic";

// POST /api/admin/points-deduction/activity-row/[id] — { action: "cancel" | "disburse" }
//
// A row in points_deduction_run_customers represents one customer matched by
// one rule during one run. Deductions already happen immediately, so:
//   - "cancel"   reverses an already-applied deduction: credits the exact
//                amount back via a new customer_points ledger entry.
//   - "disburse" is a manual courtesy credit on top of this row, usable
//                whether or not a deduction actually happened. Amount
//                defaults to the row's points_deducted but can be overridden.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requirePermission(req, "points_deduction_rules", "edit");
    if (denied) return denied;

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action !== "cancel" && action !== "disburse") {
      return validationError("action must be 'cancel' or 'disburse'");
    }

    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM points_deduction_run_customers WHERE id = ?", [id]
    );
    if (rows.length === 0) return dependencyError("Activity log row not found");
    const row = rows[0];
    const customerId = row.customer_id as string;
    const ruleName = row.rule_name as string;

    if (action === "cancel") {
      if (row.outcome !== "deducted") {
        return validationError("Only a row that actually deducted points can be cancelled");
      }
      if (row.reversed_at) {
        return validationError("This deduction has already been reversed");
      }
      const amount = Number(row.points_deducted) || 0;
      if (amount <= 0) return validationError("Nothing to reverse");

      const prevRows = await query<RowDataPacket[]>(
        "SELECT COALESCE(SUM(points), 0) AS total FROM customer_points WHERE customer_id = ?", [customerId]
      );
      const prevBalance = Number(prevRows[0]?.total) || 0;

      const entryId = await insertCustomerPoints({
        customerId, points: amount, type: "refund", referenceId: row.rule_id as string,
        description: `Reversed rule deduction: ${ruleName}`,
      });
      await execute(
        "UPDATE points_deduction_run_customers SET reversed_at = NOW(), reversal_entry_id = ? WHERE id = ?",
        [entryId, id]
      );

      await bulkNotify([customerId], {
        type: "loyalty",
        title: "Points restored",
        message: `${amount} points deducted by "${ruleName}" were reversed and credited back to your account.`,
      }).catch(() => {});
      await notifyTierUpgrade(customerId, prevBalance, prevBalance + amount).catch(() => {});
      await logActivity(`Reversed rule deduction (${amount} points)`, "customer", customerId, ruleName);

      return NextResponse.json({ success: true, entryId, amount });
    }

    // disburse
    if (row.disbursed_at) {
      return validationError("This row has already been disbursed");
    }
    const amount = Number(body?.amount);
    const finalAmount = Number.isFinite(amount) && amount > 0 ? amount : Number(row.points_deducted) || 0;
    if (finalAmount <= 0) return validationError("A positive disbursement amount is required");

    const prevRows = await query<RowDataPacket[]>(
      "SELECT COALESCE(SUM(points), 0) AS total FROM customer_points WHERE customer_id = ?", [customerId]
    );
    const prevBalance = Number(prevRows[0]?.total) || 0;

    const entryId = await insertCustomerPoints({
      customerId, points: finalAmount, type: "admin_adjustment", referenceId: row.rule_id as string,
      description: `Manual disbursement — ${ruleName}${body?.note ? `: ${body.note}` : ""}`,
    });
    await execute(
      "UPDATE points_deduction_run_customers SET disbursed_at = NOW(), disbursement_entry_id = ? WHERE id = ?",
      [entryId, id]
    );

    await bulkNotify([customerId], {
      type: "loyalty",
      title: "Points credited",
      message: `${finalAmount} points were credited to your account.`,
    }).catch(() => {});
    await notifyTierUpgrade(customerId, prevBalance, prevBalance + finalAmount).catch(() => {});
    await logActivity(`Disbursed ${finalAmount} points`, "customer", customerId, ruleName);

    return NextResponse.json({ success: true, entryId, amount: finalAmount });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
