"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldMinus, Clock, Hourglass, TrendingDown, Repeat, Crown, RotateCcw,
  Plus, Trash2, Save, Loader2, Check, PlayCircle, History, AlertTriangle,
  HelpCircle, ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { cn, randomId } from "@/lib/utils";
import {
  DEFAULT_DEDUCTION_RULE_CONFIG,
  type DeductionRule, type DeductionRuleConfig, type DeductionRuleType,
} from "@/types/points-deduction-rules";

interface Tier { id: string; name: string; }

interface RunRecord {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  rulesEvaluated: number;
  customersAffected: number;
  totalPointsDeducted: number;
  summary: { errors?: string[]; perRule?: { ruleName: string; candidates: number; customersAffected: number; pointsDeducted: number; errors: string[] }[] } | null;
}

const TYPE_META: Record<DeductionRuleType, { label: string; description: string; icon: typeof Clock }> = {
  inactivity: { label: "Inactivity", description: "No order in a set number of days", icon: Clock },
  points_expiry: { label: "Points Expiry", description: "Expire points older than a set age", icon: Hourglass },
  low_spend: { label: "Low Spend", description: "Spend below a threshold within a rolling window", icon: TrendingDown },
  flat_decay: { label: "Flat Recurring Decay", description: "Deduct a fixed amount from every active customer on a schedule", icon: Repeat },
  tier_based: { label: "Tier-Based", description: "Applies only to customers currently in specific tiers", icon: Crown },
  return_abuse: { label: "Return/Refund Abuse", description: "High return rate relative to order count", icon: RotateCcw },
};

/** Returns a list of human-readable problems with a rule, empty if it's valid. */
function validateRule(rule: DeductionRule): string[] {
  const errors: string[] = [];
  if (!rule.name.trim()) errors.push("Rule name is required.");
  if (!rule.repeatIntervalDays || rule.repeatIntervalDays < 1) errors.push("Repeat interval must be at least 1 day.");
  if (!rule.notification.title.trim()) errors.push("Notification title is required.");
  if (!rule.notification.message.trim()) errors.push("Notification message is required.");

  switch (rule.type) {
    case "inactivity":
      if (!rule.inactiveDays || rule.inactiveDays < 1) errors.push("Inactive-for days must be at least 1.");
      if (!rule.deductionAmount || rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
    case "points_expiry":
      if (!rule.expiryDays || rule.expiryDays < 1) errors.push("Expiry age must be at least 1 day.");
      break;
    case "low_spend":
      if (!rule.windowDays || rule.windowDays < 1) errors.push("Spend window must be at least 1 day.");
      if (rule.minSpendThreshold === undefined || rule.minSpendThreshold === null || rule.minSpendThreshold < 0) errors.push("Minimum spend is required.");
      if (!rule.deductionAmount || rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
    case "flat_decay":
      if (!rule.deductionAmount || rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
    case "tier_based":
      if (rule.tierIds.length === 0) errors.push("Select at least one tier.");
      if (!rule.deductionAmount || rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
    case "return_abuse":
      if (!rule.minOrders || rule.minOrders < 1) errors.push("Minimum orders must be at least 1.");
      if (!rule.returnRateThresholdPct || rule.returnRateThresholdPct <= 0) errors.push("Return rate threshold must be greater than 0%.");
      if (!rule.deductionAmount || rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
  }
  return errors;
}

function makeDefault(type: DeductionRuleType): DeductionRule {
  const base = {
    id: randomId(), type, enabled: true, name: "", repeatIntervalDays: 30,
    notification: { title: "Points deducted", message: "{points} points were deducted from your account." },
  };
  switch (type) {
    case "inactivity": return { ...base, type, inactiveDays: 90, deductionAmount: 50 };
    case "points_expiry": return { ...base, type, expiryDays: 365, capAmount: undefined };
    case "low_spend": return { ...base, type, windowDays: 90, minSpendThreshold: 1000, deductionAmount: 50 };
    case "flat_decay": return { ...base, type, deductionAmount: 10 };
    case "tier_based": return { ...base, type, tierIds: [], deductionAmount: 20 };
    case "return_abuse": return { ...base, type, minOrders: 3, returnRateThresholdPct: 30, deductionAmount: 50 };
  }
}

/** Label text plus a "?" icon whose tooltip carries the field's meaning,
 * instead of cramming an explanation into the visible label itself. */
function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" tabIndex={-1} className="text-charcoal-lighter/60 hover:text-secondary transition-colors">
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">{hint}</TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

function NumField({ label, hint, value, onChange, suffix }: { label: string; hint?: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-charcoal-light mb-1.5"><FieldLabel label={label} hint={hint} /></label>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
        {suffix && <span className="text-xs text-charcoal-lighter shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function RuleEditor({ rule, tiers, onChange }: { rule: DeductionRule; tiers: Tier[]; onChange: (patch: Partial<DeductionRule>) => void }) {
  const p = (patch: Partial<DeductionRule>) => onChange(patch);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input label={<FieldLabel label="Rule Name" hint="Internal label shown in the rules list — not seen by customers." />} value={rule.name} onChange={(e) => p({ name: e.target.value })} placeholder="e.g. Inactive 90+ days" />
        <NumField label="Repeat Interval" hint="Cooldown before this rule can fire again on the same customer." value={rule.repeatIntervalDays} onChange={(v) => p({ repeatIntervalDays: Math.max(1, v) })} suffix="days between deductions for the same customer" />
      </div>

      {rule.type === "inactivity" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Inactive For" hint="Days since their last order, or since signup if they never ordered." value={rule.inactiveDays} onChange={(v) => p({ inactiveDays: v } as Partial<DeductionRule>)} suffix="days since last order" />
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" />
        </div>
      )}

      {rule.type === "points_expiry" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Expire Points Older Than" hint="Age at which earned points become eligible to expire." value={rule.expiryDays} onChange={(v) => p({ expiryDays: v } as Partial<DeductionRule>)} suffix="days" />
          <NumField label="Cap Per Run" hint="Optional upper limit on how many points expire in one run." value={rule.capAmount || 0} onChange={(v) => p({ capAmount: v || undefined } as Partial<DeductionRule>)} suffix="points, 0 = no cap" />
          <p className="sm:col-span-2 text-[11px] text-charcoal-lighter">
            The deducted amount is always computed — whatever qualifies as expired, capped at the customer&apos;s current balance (never goes negative) and the optional cap above.
          </p>
        </div>
      )}

      {rule.type === "low_spend" && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <NumField label="Spend Window" hint="Rolling period their spend is measured over." value={rule.windowDays} onChange={(v) => p({ windowDays: v } as Partial<DeductionRule>)} suffix="days" />
            <NumField label="Minimum Spend" hint="Threshold below which the rule applies." value={rule.minSpendThreshold} onChange={(v) => p({ minSpendThreshold: v } as Partial<DeductionRule>)} suffix="৳ in window" />
            <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" />
          </div>
          <p className="text-[11px] font-medium text-charcoal-lighter uppercase tracking-wide">Optional gates (leave at 0 to skip)</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <NumField label="Minimum Account Age" hint="Exempts customers newer than this." value={rule.requireMinAccountAgeDays || 0} onChange={(v) => p({ requireMinAccountAgeDays: v || undefined } as Partial<DeductionRule>)} suffix="days — exempts brand-new signups" />
            <NumField label="Minimum Lifetime Orders" hint="Exempts customers who haven't ordered at least this many times." value={rule.requireMinLifetimeOrders || 0} onChange={(v) => p({ requireMinLifetimeOrders: v || undefined } as Partial<DeductionRule>)} suffix="orders — exempts customers who never bought" />
          </div>
        </div>
      )}

      {rule.type === "flat_decay" && (
        <NumField label="Deduct" hint="Points taken from every active customer, each time this rule fires." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points from every active customer, every repeat interval" />
      )}

      {rule.type === "tier_based" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-charcoal-light mb-1.5">
            <FieldLabel label="Applies to Tiers" hint="Only customers currently in these tiers are affected." />
          </label>
          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => {
              const selected = rule.tierIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => p({ tierIds: selected ? rule.tierIds.filter((id) => id !== t.id) : [...rule.tierIds, t.id] } as Partial<DeductionRule>)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", selected ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter")}
                >
                  {t.name}
                </button>
              );
            })}
            {tiers.length === 0 && <p className="text-xs text-charcoal-lighter">No membership tiers found.</p>}
          </div>
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" />
        </div>
      )}

      {rule.type === "return_abuse" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Minimum Orders" hint="Rule only applies once a customer has at least this many orders." value={rule.minOrders} onChange={(v) => p({ minOrders: v } as Partial<DeductionRule>)} suffix="before this rule can apply" />
          <NumField label="Return Rate Threshold" hint="Percentage of orders returned that triggers this rule." value={rule.returnRateThresholdPct} onChange={(v) => p({ returnRateThresholdPct: v } as Partial<DeductionRule>)} suffix="% of orders returned" />
          <NumField label="Lookback" hint="Optional — how far back orders/returns are counted, 0 = all-time." value={rule.lookbackDays || 0} onChange={(v) => p({ lookbackDays: v || undefined } as Partial<DeductionRule>)} suffix="days, 0 = all-time" />
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" />
        </div>
      )}

      <div className="pt-2 border-t border-border/30 space-y-2">
        <p className="text-[11px] font-medium text-charcoal-lighter uppercase tracking-wide">Customer Notification</p>
        <Input label={<FieldLabel label="Title" hint="Notification headline the customer sees." />} value={rule.notification.title} onChange={(e) => p({ notification: { ...rule.notification, title: e.target.value } })} />
        <Textarea label={<FieldLabel label="Message" hint="Notification body the customer sees." />} value={rule.notification.message} onChange={(e) => p({ notification: { ...rule.notification, message: e.target.value } })} className="min-h-[60px]" />
        <p className="text-[11px] text-charcoal-lighter">Use <code className="px-1 py-0.5 rounded bg-pearl">{"{points}"}</code> and <code className="px-1 py-0.5 rounded bg-pearl">{"{rule}"}</code> — replaced with the actual amount deducted and this rule&apos;s name.</p>
      </div>
    </div>
  );
}

export default function AdminPointsDeductionRulesPage() {
  const router = useRouter();
  const [config, setConfig] = useState<DeductionRuleConfig>(DEFAULT_DEDUCTION_RULE_CONFIG);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>("");
  const [addType, setAddType] = useState<DeductionRuleType>("inactivity");
  const [saveError, setSaveError] = useState<string>("");
  const [ruleErrors, setRuleErrors] = useState<Record<string, string[]>>({});
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);

  const fetchRuns = () => {
    setRunsLoading(true);
    fetch("/api/admin/points-deduction/run-now")
      .then((r) => r.json())
      .then((data) => setRuns(Array.isArray(data?.runs) ? data.runs : []))
      .catch(() => setRuns([]))
      .finally(() => setRunsLoading(false));
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/settings?key=points_deduction_rules").then((r) => r.json()).catch(() => null),
      fetch("/api/membership/tiers").then((r) => r.json()).catch(() => []),
    ])
      .then(([settingsData, tiersData]) => {
        if (settingsData?.value) setConfig({ ...DEFAULT_DEDUCTION_RULE_CONFIG, ...settingsData.value });
        if (Array.isArray(tiersData)) setTiers(tiersData.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      })
      .finally(() => setLoading(false));
    fetchRuns();
  }, []);

  const addItem = () => {
    setConfig((c) => ({ ...c, items: [...c.items, makeDefault(addType)] }));
  };

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateItem = (id: string, patch: Partial<DeductionRule>) => {
    setConfig((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? ({ ...i, ...patch } as DeductionRule) : i)) }));
    // Re-validate immediately so a fixed field's error clears without
    // waiting for another Save attempt.
    setRuleErrors((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
  };

  const removeItem = (id: string) => {
    setConfig((c) => ({ ...c, items: c.items.filter((i) => i.id !== id) }));
    setRuleErrors((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _removed, ...rest } = prev;
      void _removed;
      return rest;
    });
    setCollapsedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaveError("");

    const errorsByRule: Record<string, string[]> = {};
    let hasErrors = false;
    for (const rule of config.items) {
      const errors = validateRule(rule);
      if (errors.length > 0) {
        errorsByRule[rule.id] = errors;
        hasErrors = true;
      }
    }
    setRuleErrors(errorsByRule);
    if (hasErrors) {
      setSaveError("Fix the highlighted fields before saving.");
      // Expand any collapsed rule that has an error so its fields are visible.
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        for (const id of Object.keys(errorsByRule)) next.delete(id);
        return next;
      });
      return;
    }

    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "points_deduction_rules", value: config }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError("Save failed — please try again.");
    } finally { setSaving(false); }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunResult("");
    try {
      const res = await fetch("/api/admin/points-deduction/run-now", { method: "POST" });
      const data = await res.json();
      if (data?.success) {
        const errorCount = Array.isArray(data.errors) ? data.errors.length : 0;
        let text = `Evaluated ${data.rulesEvaluated} rule(s) — ${data.customersAffected} customer(s) affected, ${data.totalPointsDeducted} points deducted.`;
        if (errorCount > 0) text += ` ${errorCount} error(s) — see Recent Runs below.`;
        setRunResult(text);
        fetchRuns();
      } else {
        setRunResult(data?.error || "Run failed.");
      }
    } catch {
      setRunResult("Run failed.");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal flex items-center gap-2">
            <ShieldMinus className="h-5 w-5 text-secondary" /> Points Deduction Rules
          </h1>
          <p className="text-sm text-charcoal-lighter mt-1">
            Automatically deducts loyalty points from customer accounts when a rule&apos;s condition is met — runs on its own, about once an hour, with no setup required. Use &ldquo;Run Now&rdquo; to see a rule&apos;s effect immediately after saving it.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AdminButton variant="outline" onClick={() => router.push("/admin/points-deduction-rules/activity")}>
            <History className="h-3.5 w-3.5" /> Engine Activity Log
          </AdminButton>
          <AdminButton variant="outline" onClick={handleRunNow} disabled={running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
            {running ? "Running..." : "Run Now"}
          </AdminButton>
          <AdminButton onClick={handleSave} disabled={saving} className={cn(saved && "!bg-success hover:!bg-success")}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </AdminButton>
        </div>
      </div>

      {saveError && (
        <Card className="border-destructive/30"><CardContent className="py-3 text-sm text-destructive">{saveError}</CardContent></Card>
      )}

      {runResult && (
        <Card><CardContent className="py-3 text-sm text-charcoal-light">{runResult}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduling</CardTitle>
          <CardDescription>
            Rules run automatically about once an hour for as long as the server is running — nothing to configure.
            Saving a rule doesn&apos;t wait for the next hourly tick to take effect once; use &ldquo;Run Now&rdquo; above to apply it immediately.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-charcoal-lighter" />
            <CardTitle className="text-base">Recent Runs</CardTitle>
          </div>
          <button onClick={fetchRuns} className="text-xs text-secondary hover:underline" disabled={runsLoading}>
            {runsLoading ? "Loading..." : "Refresh"}
          </button>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <p className="text-sm text-charcoal-lighter py-2">Loading run history...</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-charcoal-lighter py-2">
              No runs recorded yet. The automatic scheduler runs its first check about 30 seconds after the server
              starts, then hourly — if this stays empty after a couple of minutes, use &ldquo;Run Now&rdquo; above to trigger one manually and check for errors.
            </p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const runErrors = run.summary?.errors || [];
                return (
                  <div key={run.id} className={cn("p-3 rounded-lg border", runErrors.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border/30")}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-xs text-charcoal-lighter">{new Date(run.startedAt).toLocaleString()}</span>
                      <span className="text-xs text-charcoal-light">
                        {run.rulesEvaluated} rule(s) · {run.customersAffected} customer(s) · {run.totalPointsDeducted} points
                      </span>
                    </div>
                    {runErrors.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {runErrors.map((e, i) => (
                          <p key={i} className="text-xs text-destructive flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {e}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Rule</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Select value={addType} onValueChange={(v) => setAddType(v as DeductionRuleType)}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_META) as DeductionRuleType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AdminButton variant="outline" onClick={addItem}><Plus className="h-3.5 w-3.5" /> Add</AdminButton>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {config.items.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-charcoal-lighter">
            No rules yet — nothing will be deducted until you add and enable at least one.
          </CardContent></Card>
        )}

        {config.items.map((item) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.icon;
          const errors = ruleErrors[item.id] || [];
          const collapsed = collapsedIds.has(item.id);
          return (
            <Card key={item.id} className={cn(errors.length > 0 && "border-destructive/40")}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(item.id)}
                  className="flex items-center gap-3 min-w-0 text-left flex-1"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light shrink-0"><Icon className="h-4 w-4 text-secondary" /></div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{item.name || meta.label}</CardTitle>
                    <CardDescription className="text-xs">{meta.description}</CardDescription>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-charcoal-lighter shrink-0 ml-auto transition-transform duration-200", collapsed && "-rotate-90")} />
                </button>
                <div className="flex items-center gap-1 shrink-0 pl-2">
                  <Switch checked={item.enabled} onCheckedChange={(v) => updateItem(item.id, { enabled: v })} />
                  <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-md text-charcoal-lighter/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              {!collapsed && (
              <CardContent className="space-y-3">
                {errors.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 space-y-0.5">
                    {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
                  </div>
                )}
                <RuleEditor rule={item} tiers={tiers} onChange={(patch) => updateItem(item.id, patch)} />
              </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
    </TooltipProvider>
  );
}
