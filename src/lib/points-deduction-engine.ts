import { query, execute } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { bulkNotify } from "@/lib/notify";
import type {
  DeductionRule, DeductionRuleConfig, EngineRunSummary, RuleRunSummary,
} from "@/types/points-deduction-rules";

interface Candidate {
  id: string;
  /** Human-readable snapshot of the specific values that matched this rule. */
  criteria: string;
}

const SETTINGS_KEY = "points_deduction_rules";

async function loadRules(): Promise<DeductionRule[]> {
  const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = ?", [SETTINGS_KEY]);
  if (rows.length === 0) return [];
  try {
    const parsed = JSON.parse(rows[0].value as string) as DeductionRuleConfig;
    return Array.isArray(parsed?.items) ? parsed.items.filter((r) => r.enabled) : [];
  } catch {
    return [];
  }
}

/** Customers still within a rule's cooldown, based on their last ledger entry for this rule. */
async function getCustomersInCooldown(ruleId: string, repeatIntervalDays: number, customerIds: string[]): Promise<Set<string>> {
  if (customerIds.length === 0) return new Set();
  const placeholders = customerIds.map(() => "?").join(",");
  const rows = await query<RowDataPacket[]>(
    `SELECT customer_id, MAX(created_at) AS last_fired
     FROM customer_points
     WHERE type = 'rule_deduction' AND reference_id = ? AND customer_id IN (${placeholders})
     GROUP BY customer_id`,
    [ruleId, ...customerIds]
  );
  const cutoffMs = Date.now() - Math.max(1, repeatIntervalDays) * 86400000;
  const inCooldown = new Set<string>();
  for (const r of rows) {
    const lastFired = new Date(r.last_fired as string).getTime();
    if (lastFired > cutoffMs) inCooldown.add(r.customer_id as string);
  }
  return inCooldown;
}

async function getCurrentBalance(customerId: string): Promise<number> {
  const rows = await query<RowDataPacket[]>(
    "SELECT COALESCE(SUM(points), 0) AS total FROM customer_points WHERE customer_id = ?",
    [customerId]
  );
  return Number(rows[0]?.total) || 0;
}

/** Candidate customers for a rule, before cooldown filtering, each tagged
 * with a human-readable snapshot of the values that matched. Each query is
 * self-contained per rule type using only confirmed real columns. */
async function getCandidates(rule: DeductionRule): Promise<Candidate[]> {
  switch (rule.type) {
    case "inactivity": {
      const rows = await query<RowDataPacket[]>(
        `SELECT id, last_order_at, created_at FROM customers
         WHERE is_active = 1
           AND (
             (last_order_at IS NOT NULL AND last_order_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
             OR (last_order_at IS NULL AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
           )`,
        [rule.inactiveDays, rule.inactiveDays]
      );
      const now = Date.now();
      return rows.map((r) => {
        const since = r.last_order_at ? new Date(r.last_order_at as string) : new Date(r.created_at as string);
        const days = Math.floor((now - since.getTime()) / 86400000);
        const basis = r.last_order_at ? "last order" : "signup, never ordered";
        return { id: r.id as string, criteria: `${days} days since ${basis} (threshold: ${rule.inactiveDays})` };
      });
    }

    case "points_expiry": {
      const rows = await query<RowDataPacket[]>(
        `SELECT customer_id, SUM(points) AS expiring_points FROM customer_points
         WHERE created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY customer_id
         HAVING SUM(points) > 0`,
        [rule.expiryDays]
      );
      return rows.map((r) => ({
        id: r.customer_id as string,
        criteria: `${Number(r.expiring_points) || 0} points earned more than ${rule.expiryDays} days ago`,
      }));
    }

    case "low_spend": {
      // Params are pushed in the exact order their `?` placeholders appear in
      // the SQL string below (join-date filter, then optional where-date
      // gate, then the having-threshold) — built in that order explicitly
      // rather than spliced in, so the two can never drift out of sync.
      const params: (string | number)[] = [rule.windowDays];
      let where = "WHERE c.is_active = 1";
      if (rule.requireMinAccountAgeDays) {
        where += " AND c.created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)";
        params.push(rule.requireMinAccountAgeDays);
      }
      params.push(rule.minSpendThreshold);
      const rows = await query<RowDataPacket[]>(
        `SELECT c.id, c.total_orders, COALESCE(SUM(o.total), 0) AS window_spend
         FROM customers c
         LEFT JOIN orders o ON o.customer_id = c.id
           AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
           AND o.status <> 'cancelled'
         ${where}
         GROUP BY c.id, c.total_orders
         HAVING window_spend < ?`,
        params
      );
      const minOrders = rule.requireMinLifetimeOrders || 0;
      return rows
        .filter((r) => Number(r.total_orders) >= minOrders)
        .map((r) => ({
          id: r.id as string,
          criteria: `Spent ${Number(r.window_spend) || 0} in last ${rule.windowDays} days (threshold: ${rule.minSpendThreshold})`,
        }));
    }

    case "flat_decay": {
      const rows = await query<RowDataPacket[]>("SELECT id FROM customers WHERE is_active = 1");
      return rows.map((r) => ({ id: r.id as string, criteria: `Recurring decay applied to every active customer` }));
    }

    case "tier_based": {
      if (rule.tierIds.length === 0) return [];
      const placeholders = rule.tierIds.map(() => "?").join(",");
      const tiers = await query<RowDataPacket[]>(
        `SELECT id, name, min_points, max_points FROM membership_tiers WHERE id IN (${placeholders}) AND is_active = 1`,
        rule.tierIds
      );
      if (tiers.length === 0) return [];
      const balances = await query<RowDataPacket[]>(
        `SELECT c.id, COALESCE(SUM(cp.points), 0) AS total_points
         FROM customers c LEFT JOIN customer_points cp ON cp.customer_id = c.id
         WHERE c.is_active = 1
         GROUP BY c.id`
      );
      const matches: Candidate[] = [];
      for (const b of balances) {
        const total = Number(b.total_points) || 0;
        const tier = tiers.find((t) => total >= Number(t.min_points) && total <= Number(t.max_points));
        if (tier) matches.push({ id: b.id as string, criteria: `In tier "${tier.name}" with ${total} points` });
      }
      return matches;
    }

    case "return_abuse": {
      const params: (string | number)[] = [];
      let dateFilter = "";
      if (rule.lookbackDays) {
        dateFilter = " AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
        params.push(rule.lookbackDays);
      }
      params.push(rule.minOrders, rule.returnRateThresholdPct);
      const rows = await query<RowDataPacket[]>(
        `SELECT o.customer_id,
                COUNT(DISTINCT o.id) AS order_count,
                COUNT(DISTINCT r.id) AS return_count
         FROM orders o
         LEFT JOIN order_returns r ON r.order_id = o.id AND r.status <> 'rejected'
         WHERE o.customer_id IS NOT NULL AND o.status <> 'cancelled'${dateFilter}
         GROUP BY o.customer_id
         HAVING order_count >= ? AND (return_count / order_count) * 100 > ?`,
        params
      );
      return rows.map((r) => {
        const orderCount = Number(r.order_count) || 0;
        const returnCount = Number(r.return_count) || 0;
        const pct = orderCount > 0 ? Math.round((returnCount / orderCount) * 1000) / 10 : 0;
        return {
          id: r.customer_id as string,
          criteria: `${returnCount}/${orderCount} orders returned (${pct}%, threshold: ${rule.returnRateThresholdPct}%)`,
        };
      });
    }
  }
}

/** Points to deduct for one candidate customer, given the rule and their current balance. */
async function computeDeduction(rule: DeductionRule, customerId: string, currentBalance: number): Promise<number> {
  if (rule.type === "points_expiry") {
    const rows = await query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(points), 0) AS expiring
       FROM customer_points WHERE customer_id = ? AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [customerId, rule.expiryDays]
    );
    let amount = Math.max(0, Number(rows[0]?.expiring) || 0);
    if (rule.capAmount) amount = Math.min(amount, rule.capAmount);
    return Math.min(amount, currentBalance);
  }
  return Math.min(rule.deductionAmount, currentBalance);
}

function interpolate(template: string, tokens: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in tokens ? String(tokens[key]) : `{${key}}`));
}

/** Persist one Engine Activity Log row. Best-effort — a logging failure
 * shouldn't undo a deduction that already happened, so it's only reported
 * into the run's errors, never thrown back up to the caller. */
async function logCustomerResult(
  runId: string, rule: DeductionRule, customerId: string, criteria: string,
  outcome: "deducted" | "skipped_no_balance" | "error",
  pointsDeducted: number, pointsEntryId: string | null, errorMessage: string | null
): Promise<void> {
  const rowId = `pdrc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await execute(
    `INSERT INTO points_deduction_run_customers
     (id, run_id, rule_id, rule_name, rule_type, customer_id, outcome, points_deducted, matched_criteria, error_message, points_entry_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [rowId, runId, rule.id, rule.name, rule.type, customerId, outcome, pointsDeducted, criteria, errorMessage, pointsEntryId]
  );
}

async function runRule(runId: string, rule: DeductionRule): Promise<RuleRunSummary> {
  const summary: RuleRunSummary = {
    ruleId: rule.id, ruleName: rule.name, type: rule.type,
    candidates: 0, customersAffected: 0, pointsDeducted: 0, errors: [],
  };

  let candidates: Candidate[] = [];
  try {
    candidates = await getCandidates(rule);
  } catch (err) {
    summary.errors.push(`candidate query failed: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }
  summary.candidates = candidates.length;
  if (candidates.length === 0) return summary;

  let eligible: Candidate[];
  try {
    const inCooldown = await getCustomersInCooldown(rule.id, rule.repeatIntervalDays, candidates.map((c) => c.id));
    eligible = candidates.filter((c) => !inCooldown.has(c.id));
  } catch (err) {
    summary.errors.push(`cooldown check failed: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }

  for (const { id: customerId, criteria } of eligible) {
    try {
      const balance = await getCurrentBalance(customerId);
      if (balance <= 0) {
        await logCustomerResult(runId, rule, customerId, criteria, "skipped_no_balance", 0, null, null).catch(() => {});
        continue; // nothing to deduct, not an error
      }

      const amount = await computeDeduction(rule, customerId, balance);
      if (amount <= 0) {
        await logCustomerResult(runId, rule, customerId, criteria, "skipped_no_balance", 0, null, null).catch(() => {});
        continue;
      }

      const entryId = `pts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await execute(
        "INSERT INTO customer_points (id, customer_id, points, type, reference_id, description) VALUES (?, ?, ?, 'rule_deduction', ?, ?)",
        [entryId, customerId, -amount, rule.id, `Rule deduction: ${rule.name}`]
      );

      const title = interpolate(rule.notification.title, { points: amount, rule: rule.name });
      const message = interpolate(rule.notification.message, { points: amount, rule: rule.name });
      await bulkNotify([customerId], { type: "loyalty", title, message }).catch(() => {});

      await logCustomerResult(runId, rule, customerId, criteria, "deducted", amount, entryId, null).catch(() => {});

      summary.customersAffected += 1;
      summary.pointsDeducted += amount;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`customer ${customerId}: ${message}`);
      await logCustomerResult(runId, rule, customerId, criteria, "error", 0, null, message).catch(() => {});
    }
  }

  return summary;
}

export async function runPointsDeductionEngine(): Promise<EngineRunSummary> {
  const runId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const setupErrors: string[] = [];

  try {
    await ensurePromotionColumns();
  } catch (err) {
    // Should already be caught inside ensurePromotionColumns, but guard here
    // too so a schema mismatch is reported instead of aborting the run with
    // no trace anywhere the admin can see.
    setupErrors.push(`schema migration failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const rules = await loadRules();

  const perRule: RuleRunSummary[] = [];
  for (const rule of rules) {
    perRule.push(await runRule(runId, rule));
  }

  const finishedAt = new Date().toISOString();
  const customersAffected = perRule.reduce((s, r) => s + r.customersAffected, 0);
  const totalPointsDeducted = perRule.reduce((s, r) => s + r.pointsDeducted, 0);
  const errors = [...setupErrors, ...perRule.flatMap((r) => r.errors)];

  const summary: EngineRunSummary = {
    startedAt, finishedAt, rulesEvaluated: rules.length, customersAffected, totalPointsDeducted, perRule, errors,
  };

  try {
    await execute(
      "INSERT INTO points_deduction_runs (id, started_at, finished_at, rules_evaluated, customers_affected, total_points_deducted, summary) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [runId, startedAt, finishedAt, rules.length, customersAffected, totalPointsDeducted, JSON.stringify(summary)]
    );
  } catch (err) {
    console.error("[points-deduction-engine] failed to record run:", err);
  }

  return summary;
}
