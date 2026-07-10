import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { notifyTierUpgrade, bulkNotify } from "@/lib/notify";
import { validationError, dependencyError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST /api/admin/points-deduction/activity-row/[id] — { action: "cancel" | "disburse" }
//
// A row in points_deduction_run_customers represents one customer matched by
// one rule during one run. Deductions already happen immediately (there's no
// pending/approval step), so:
//   - "cancel"   reverses an already-applied deduction: credits the exact
//                amount back via a new customer_points ledger entry (the
//                original deduction row is never edited — append-only ledger,
//                same convention as every other points/partner transaction in
//                this codebase) and marks the row reversed.
//   - "disburse" is a manual courtesy credit on top of this row (e.g. "waive
//                it and give them 50 points"), usable whether or not a
//                deduction actually happened (a skipped/error row has nothing
//                to cancel, but an admin may still want to credit the
//                customer). Amount defaults to the row's points_deducted but
//                can be overridden.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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

      const entryId = `pts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await execute(
        "INSERT INTO customer_points (id, customer_id, points, type, reference_id, description) VALUES (?, ?, ?, 'refund', ?, ?)",
        [entryId, customerId, amount, row.rule_id, `Reversed rule deduction: ${ruleName}`]
      );
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

    const entryId = `pts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await execute(
      "INSERT INTO customer_points (id, customer_id, points, type, reference_id, description) VALUES (?, ?, ?, 'admin_adjustment', ?, ?)",
      [entryId, customerId, finalAmount, row.rule_id, `Manual disbursement — ${ruleName}${body?.note ? `: ${body.note}` : ""}`]
    );
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
