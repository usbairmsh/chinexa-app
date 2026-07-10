import { query, execute } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";
import { ensurePromotionColumns } from "@/lib/migrate-promotions";
import { bulkNotify } from "@/lib/notify";
import type {
  DeductionRule, DeductionRuleConfig, EngineRunSummary, RuleRunSummary,
} from "@/types/points-deduction-rules";

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

/** Candidate customer ids for a rule, before cooldown filtering. Each query is
 * self-contained per rule type using only confirmed real columns. */
async function getCandidates(rule: DeductionRule): Promise<string[]> {
  switch (rule.type) {
    case "inactivity": {
      const rows = await query<RowDataPacket[]>(
        `SELECT id FROM customers
         WHERE is_active = 1
           AND (
             (last_order_at IS NOT NULL AND last_order_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
             OR (last_order_at IS NULL AND created_at <= DATE_SUB(NOW(), INTERVAL ? DAY))
           )`,
        [rule.inactiveDays, rule.inactiveDays]
      );
      return rows.map((r) => r.id as string);
    }

    case "points_expiry": {
      const rows = await query<RowDataPacket[]>(
        `SELECT customer_id FROM customer_points
         WHERE created_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY customer_id
         HAVING SUM(points) > 0`,
        [rule.expiryDays]
      );
      return rows.map((r) => r.customer_id as string);
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
        .map((r) => r.id as string);
    }

    case "flat_decay": {
      const rows = await query<RowDataPacket[]>("SELECT id FROM customers WHERE is_active = 1");
      return rows.map((r) => r.id as string);
    }

    case "tier_based": {
      if (rule.tierIds.length === 0) return [];
      const placeholders = rule.tierIds.map(() => "?").join(",");
      const tiers = await query<RowDataPacket[]>(
        `SELECT id, min_points, max_points FROM membership_tiers WHERE id IN (${placeholders}) AND is_active = 1`,
        rule.tierIds
      );
      if (tiers.length === 0) return [];
      const balances = await query<RowDataPacket[]>(
        `SELECT c.id, COALESCE(SUM(cp.points), 0) AS total_points
         FROM customers c LEFT JOIN customer_points cp ON cp.customer_id = c.id
         WHERE c.is_active = 1
         GROUP BY c.id`
      );
      const matches: string[] = [];
      for (const b of balances) {
        const total = Number(b.total_points) || 0;
        if (tiers.some((t) => total >= Number(t.min_points) && total <= Number(t.max_points))) {
          matches.push(b.id as string);
        }
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
      return rows.map((r) => r.customer_id as string);
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

async function runRule(rule: DeductionRule): Promise<RuleRunSummary> {
  const summary: RuleRunSummary = {
    ruleId: rule.id, ruleName: rule.name, type: rule.type,
    candidates: 0, customersAffected: 0, pointsDeducted: 0, errors: [],
  };

  let candidates: string[] = [];
  try {
    candidates = await getCandidates(rule);
  } catch (err) {
    summary.errors.push(`candidate query failed: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }
  summary.candidates = candidates.length;
  if (candidates.length === 0) return summary;

  let eligible: string[];
  try {
    const inCooldown = await getCustomersInCooldown(rule.id, rule.repeatIntervalDays, candidates);
    eligible = candidates.filter((id) => !inCooldown.has(id));
  } catch (err) {
    summary.errors.push(`cooldown check failed: ${err instanceof Error ? err.message : String(err)}`);
    return summary;
  }

  for (const customerId of eligible) {
    try {
      const balance = await getCurrentBalance(customerId);
      if (balance <= 0) continue; // nothing to deduct, not an error

      const amount = await computeDeduction(rule, customerId, balance);
      if (amount <= 0) continue;

      const entryId = `pts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await execute(
        "INSERT INTO customer_points (id, customer_id, points, type, reference_id, description) VALUES (?, ?, ?, 'rule_deduction', ?, ?)",
        [entryId, customerId, -amount, rule.id, `Rule deduction: ${rule.name}`]
      );

      const title = interpolate(rule.notification.title, { points: amount, rule: rule.name });
      const message = interpolate(rule.notification.message, { points: amount, rule: rule.name });
      await bulkNotify([customerId], { type: "loyalty", title, message }).catch(() => {});

      summary.customersAffected += 1;
      summary.pointsDeducted += amount;
    } catch (err) {
      summary.errors.push(`customer ${customerId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}

export async function runPointsDeductionEngine(): Promise<EngineRunSummary> {
  await ensurePromotionColumns();
  const startedAt = new Date().toISOString();
  const rules = await loadRules();

  const perRule: RuleRunSummary[] = [];
  for (const rule of rules) {
    perRule.push(await runRule(rule));
  }

  const finishedAt = new Date().toISOString();
  const customersAffected = perRule.reduce((s, r) => s + r.customersAffected, 0);
  const totalPointsDeducted = perRule.reduce((s, r) => s + r.pointsDeducted, 0);
  const errors = perRule.flatMap((r) => r.errors);

  const summary: EngineRunSummary = {
    startedAt, finishedAt, rulesEvaluated: rules.length, customersAffected, totalPointsDeducted, perRule, errors,
  };

  try {
    const runId = `run-${Date.now()}`;
    await execute(
      "INSERT INTO points_deduction_runs (id, started_at, finished_at, rules_evaluated, customers_affected, total_points_deducted, summary) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [runId, startedAt, finishedAt, rules.length, customersAffected, totalPointsDeducted, JSON.stringify(summary)]
    );
  } catch (err) {
    console.error("[points-deduction-engine] failed to record run:", err);
  }

  return summary;
}
