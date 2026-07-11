import { execute } from "@/lib/db";

export type CustomerPointsType =
  | "purchase" | "bonus" | "redemption" | "admin_adjustment" | "coupon_reward" | "refund" | "rule_deduction";

interface InsertCustomerPointsParams {
  customerId: string;
  points: number;
  type: CustomerPointsType;
  referenceId?: string | null;
  description?: string | null;
}

/**
 * The single write path for the customer_points ledger. Every route that
 * changes a customer's balance should go through this — not just for the
 * insert itself, but because it's what lets an instant-mode tier-based
 * deduction rule react to a balance change no matter which of the (currently
 * three) call sites caused it, without each one having to remember to call
 * the check itself.
 */
export async function insertCustomerPoints(params: InsertCustomerPointsParams): Promise<string> {
  const id = `pts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await execute(
    "INSERT INTO customer_points (id, customer_id, points, type, reference_id, description) VALUES (?, ?, ?, ?, ?, ?)",
    [id, params.customerId, params.points, params.type, params.referenceId || null, params.description || null]
  );

  // Fire-and-forget: an instant-rule check failing should never roll back or
  // block the points insert that triggered it.
  if (params.type !== "rule_deduction") {
    const { checkInstantTierRules } = await import("@/lib/points-deduction-engine");
    checkInstantTierRules(params.customerId).catch((err) => {
      console.error("[points] instant tier-rule check failed:", err);
    });
  }

  return id;
}
