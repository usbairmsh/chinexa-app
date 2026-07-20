"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldMinus, Clock, Hourglass, TrendingDown, Crown, RotateCcw,
  Plus, Trash2, Save, Loader2, Check, PlayCircle, History, ChevronDown, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { cn, randomId, collectMissingFields } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";
import {
  DEFAULT_DEDUCTION_ENGINE_CONFIG, DEFAULT_RULE_INTERVAL_DAYS,
  DEFAULT_RULE_NOTIFICATION_TITLE, DEFAULT_RULE_NOTIFICATION_MESSAGE,
  type DeductionRule, type DeductionEngineConfig, type DeductionRuleType,
} from "@/types/points-deduction-rules";

interface Tier { id: string; name: string; }

interface LastRun {
  runId: string; triggerSource: string; startedAt: string; finishedAt: string | null;
  rulesEvaluated: number; customersAffected: number; totalPointsDeducted: number;
  summary: { errors?: string[] } | null;
}

const TYPE_META: Record<DeductionRuleType, { label: string; description: string; icon: typeof Clock; instantEligible: boolean }> = {
  inactivity: { label: "Inactivity", description: "No order in a set number of days", icon: Clock, instantEligible: false },
  points_expiry: { label: "Points Expiry", description: "Expire points older than a set age", icon: Hourglass, instantEligible: false },
  low_spend: { label: "Low Spend", description: "Spend below a threshold within a rolling window", icon: TrendingDown, instantEligible: false },
  tier_based: { label: "Tier-Based", description: "Applies only to customers currently in specific tiers", icon: Crown, instantEligible: true },
  return_abuse: { label: "Return/Refund Abuse", description: "High return rate relative to order count", icon: RotateCcw, instantEligible: true },
};

function validateRule(rule: DeductionRule): string[] {
  const errors: string[] = [];

  // Missing-field checks — collected into one combined message instead of
  // reporting only the first blank field.
  const missingFields: { label: string; value: unknown }[] = [
    { label: "Rule Name", value: rule.name },
  ];
  if (rule.advancedEnabled) {
    missingFields.push(
      { label: "Notification Title", value: rule.notificationTitle },
      { label: "Notification Message", value: rule.notificationMessage },
    );
  }
  switch (rule.type) {
    case "inactivity":
      missingFields.push({ label: "Inactive For", value: rule.inactiveDays }, { label: "Deduct", value: rule.deductionAmount });
      break;
    case "points_expiry":
      missingFields.push({ label: "Expire Points Older Than", value: rule.expiryDays });
      break;
    case "low_spend":
      missingFields.push(
        { label: "Spend Window", value: rule.windowDays },
        { label: "Minimum Spend", value: rule.minSpendThreshold },
        { label: "Deduct", value: rule.deductionAmount },
      );
      break;
    case "tier_based":
      missingFields.push({ label: "Applies to Tiers", value: rule.tierIds.length > 0 }, { label: "Deduct", value: rule.deductionAmount });
      break;
    case "return_abuse":
      missingFields.push(
        { label: "Minimum Orders", value: rule.minOrders },
        { label: "Return Rate Threshold", value: rule.returnRateThresholdPct },
        { label: "Deduct", value: rule.deductionAmount },
      );
      break;
  }
  const missing = collectMissingFields(missingFields);
  if (missing) errors.push(missing);

  // Value-constraint checks (already present and non-zero, but out of range) — kept separate.
  if (rule.advancedEnabled) {
    if (!Number.isFinite(rule.repeatIntervalDays) || rule.repeatIntervalDays < 0) errors.push("Repeat interval must be zero or a positive number of days.");
  }
  switch (rule.type) {
    case "inactivity":
      if (rule.inactiveDays && rule.inactiveDays < 1) errors.push("Inactive-for days must be at least 1.");
      if (rule.deductionAmount && rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
    case "points_expiry":
      if (rule.expiryDays && rule.expiryDays < 1) errors.push("Expiry age must be at least 1 day.");
      break;
    case "low_spend":
      if (rule.windowDays && rule.windowDays < 1) errors.push("Spend window must be at least 1 day.");
      if (rule.minSpendThreshold !== undefined && rule.minSpendThreshold !== null && rule.minSpendThreshold < 0) errors.push("Minimum spend cannot be negative.");
      if (rule.deductionAmount && rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
    case "tier_based":
      if (rule.deductionAmount && rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
    case "return_abuse":
      if (rule.minOrders && rule.minOrders < 1) errors.push("Minimum orders must be at least 1.");
      if (rule.returnRateThresholdPct && rule.returnRateThresholdPct <= 0) errors.push("Return rate threshold must be greater than 0%.");
      if (rule.deductionAmount && rule.deductionAmount < 1) errors.push("Deduction amount must be at least 1 point.");
      break;
  }
  return errors;
}

function makeDefault(type: DeductionRuleType): DeductionRule {
  const base = {
    id: randomId(), type, enabled: true, name: "",
    advancedEnabled: false,
    repeatIntervalDays: DEFAULT_RULE_INTERVAL_DAYS,
    notificationTitle: DEFAULT_RULE_NOTIFICATION_TITLE,
    notificationMessage: DEFAULT_RULE_NOTIFICATION_MESSAGE,
  };
  switch (type) {
    case "inactivity": return { ...base, type, inactiveDays: 90, deductionAmount: 50 };
    case "points_expiry": return { ...base, type, expiryDays: 365 };
    case "low_spend": return { ...base, type, windowDays: 90, minSpendThreshold: 1000, deductionAmount: 50 };
    case "tier_based": return { ...base, type, tierIds: [], deductionAmount: 20, instant: false };
    case "return_abuse": return { ...base, type, minOrders: 3, returnRateThresholdPct: 30, deductionAmount: 50, instant: false };
  }
}

function NumField({ label, hint, value, onChange, suffix, disabled, required }: { label: string; hint?: string; value: number; onChange: (v: number) => void; suffix?: string; disabled?: boolean; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-charcoal-light mb-1.5"><FieldLabel label={label} hint={hint} required={required} /></label>
      <div className="flex items-center gap-2">
        <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} disabled={disabled} required={required} />
        {suffix && <span className="text-xs text-charcoal-lighter shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function isInstant(rule: DeductionRule): boolean {
  return (rule.type === "tier_based" || rule.type === "return_abuse") && rule.instant;
}

function RuleEditor({ rule, tiers, onChange, canEdit }: { rule: DeductionRule; tiers: Tier[]; onChange: (patch: Partial<DeductionRule>) => void; canEdit: boolean }) {
  const p = (patch: Partial<DeductionRule>) => onChange(patch);
  const meta = TYPE_META[rule.type];

  return (
    <div className="space-y-4">
      <Input label="Rule Name" value={rule.name} onChange={(e) => p({ name: e.target.value })} placeholder="e.g. Inactive 90+ days" disabled={!canEdit} required />

      {rule.type === "inactivity" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Inactive For" hint="Days since their last order (or since signup if they never ordered)." value={rule.inactiveDays} onChange={(v) => p({ inactiveDays: v } as Partial<DeductionRule>)} suffix="days since last order" disabled={!canEdit} required />
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" disabled={!canEdit} required />
        </div>
      )}

      {rule.type === "points_expiry" && (
        <NumField label="Expire Points Older Than" hint="Age at which earned points become eligible to expire. The amount expired is always computed live — whatever qualifies, capped at the customer's current balance." value={rule.expiryDays} onChange={(v) => p({ expiryDays: v } as Partial<DeductionRule>)} suffix="days" disabled={!canEdit} required />
      )}

      {rule.type === "low_spend" && (
        <div className="grid sm:grid-cols-3 gap-3">
          <NumField label="Spend Window" hint="Rolling period their spend is measured over." value={rule.windowDays} onChange={(v) => p({ windowDays: v } as Partial<DeductionRule>)} suffix="days" disabled={!canEdit} required />
          <NumField label="Minimum Spend" hint="Threshold below which the rule applies." value={rule.minSpendThreshold} onChange={(v) => p({ minSpendThreshold: v } as Partial<DeductionRule>)} suffix="৳ in window" disabled={!canEdit} required />
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" disabled={!canEdit} required />
        </div>
      )}

      {rule.type === "tier_based" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-charcoal-light mb-1.5">
              <FieldLabel label="Applies to Tiers" hint="Only customers currently in these tiers are affected." required />
            </label>
            <div className="flex flex-wrap gap-2">
              {tiers.map((t) => {
                const selected = rule.tierIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => p({ tierIds: selected ? rule.tierIds.filter((id) => id !== t.id) : [...rule.tierIds, t.id] } as Partial<DeductionRule>)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100", selected ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter")}
                  >
                    {t.name}
                  </button>
                );
              })}
              {tiers.length === 0 && <p className="text-xs text-charcoal-lighter">No membership tiers found.</p>}
            </div>
          </div>
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" disabled={!canEdit} required />
        </div>
      )}

      {rule.type === "return_abuse" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Minimum Orders" hint="Rule only applies once a customer has at least this many orders." value={rule.minOrders} onChange={(v) => p({ minOrders: v } as Partial<DeductionRule>)} suffix="before this rule can apply" disabled={!canEdit} required />
          <NumField label="Return Rate Threshold" hint="Percentage of orders returned that triggers this rule." value={rule.returnRateThresholdPct} onChange={(v) => p({ returnRateThresholdPct: v } as Partial<DeductionRule>)} suffix="% of orders returned" disabled={!canEdit} required />
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" disabled={!canEdit} required />
        </div>
      )}

      {meta.instantEligible && (rule.type === "tier_based" || rule.type === "return_abuse") && (
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <p className="text-sm font-medium text-charcoal">
            <FieldLabel
              label={<span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-secondary" /> Instant</span>}
              hint={
                rule.type === "tier_based"
                  ? "Fires the moment this customer's point balance changes (from any purchase, return, or manual adjustment) instead of waiting for the hourly check."
                  : "Fires the moment a return is approved for this customer instead of waiting for the hourly check."
              }
            />
          </p>
          <Switch checked={rule.instant} onCheckedChange={(v) => p({ instant: v } as Partial<DeductionRule>)} disabled={!canEdit} />
        </div>
      )}
      {!meta.instantEligible && (
        <p className="text-[11px] text-charcoal-lighter flex items-center gap-1">
          <FieldLabel label="No instant option" hint="This rule type is based on drift over time (inactivity/expiry) or a direction that can't newly trigger a violation from a single event, so it's only checked on the hourly schedule." />
        </p>
      )}

      <div className="pt-2 border-t border-border/30 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox checked={rule.advancedEnabled} onCheckedChange={(v) => p({ advancedEnabled: v === true } as Partial<DeductionRule>)} disabled={!canEdit} />
          <span className="text-sm font-medium text-charcoal">
            <FieldLabel label="Advanced settings" hint="Set a custom repeat cooldown and notification just for this rule. Left unchecked, it uses the default cooldown (30 days) and a generic notification." />
          </span>
        </label>

        {rule.advancedEnabled && (
          <div className="space-y-3 pl-7">
            {!(isInstant(rule)) && (
              <NumField
                label="Repeat Interval"
                hint="Cooldown before this rule can fire again on the same customer. 0 means no cooldown."
                value={rule.repeatIntervalDays}
                onChange={(v) => p({ repeatIntervalDays: Math.max(0, v) } as Partial<DeductionRule>)}
                suffix="days between deductions for the same customer"
                disabled={!canEdit}
                required
              />
            )}
            <Input
              label={<FieldLabel label="Notification Title" hint="Headline the customer sees when this rule deducts their points." required />}
              value={rule.notificationTitle}
              onChange={(e) => p({ notificationTitle: e.target.value } as Partial<DeductionRule>)}
              disabled={!canEdit}
              required
            />
            <Textarea
              label={<FieldLabel label="Notification Message" hint="Body text the customer sees. Supports {points} and {rule} tokens." required />}
              value={rule.notificationMessage}
              onChange={(e) => p({ notificationMessage: e.target.value } as Partial<DeductionRule>)}
              className="min-h-[60px]"
              disabled={!canEdit}
              required
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPointsDeductionRulesPage() {
  const router = useRouter();
  const { can } = useAdmin();
  const canAdd = can("points_deduction_rules", "add");
  const canEdit = can("points_deduction_rules", "edit");
  const canDelete = can("points_deduction_rules", "delete");
  const [config, setConfig] = useState<DeductionEngineConfig>(DEFAULT_DEDUCTION_ENGINE_CONFIG);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>("");
  const [addType, setAddType] = useState<DeductionRuleType>("inactivity");
  const [saveError, setSaveError] = useState<string>("");
  const [loadError, setLoadError] = useState<string>("");
  const [ruleErrors, setRuleErrors] = useState<Record<string, string[]>>({});
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [lastRun, setLastRun] = useState<LastRun | null>(null);

  const fetchData = () => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      fetch("/api/admin/points-deduction").then((r) => r.json()).catch(() => null),
      fetch("/api/membership/tiers").then((r) => r.json()).catch(() => []),
    ])
      .then(([data, tiersData]) => {
        // A load failure (e.g. a schema mismatch on the server) must never be
        // treated as "no rules configured" — that would blank the list on
        // screen even though the saved config is still intact in the database.
        if (data?.error) {
          setLoadError(`Couldn't load rules: ${data.error}`);
          return;
        }
        if (data?.config) setConfig(data.config);
        if (data?.lastRun) setLastRun(data.lastRun);
        if (Array.isArray(tiersData)) setTiers(tiersData.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

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
  };

  const handleSave = async () => {
    setSaveError("");

    const errorsByRule: Record<string, string[]> = {};
    let hasErrors = false;
    for (const rule of config.items) {
      const errors = validateRule(rule);
      if (errors.length > 0) { errorsByRule[rule.id] = errors; hasErrors = true; }
    }
    setRuleErrors(errorsByRule);
    if (hasErrors) {
      setSaveError("Fix the highlighted fields before saving.");
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        for (const id of Object.keys(errorsByRule)) next.delete(id);
        return next;
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/points-deduction", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed — please try again.");
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
        if (errorCount > 0) text += ` ${errorCount} error(s) — see Engine Activity Log.`;
        setRunResult(text);
        fetchData();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal flex items-center gap-2">
            <ShieldMinus className="h-5 w-5 text-secondary" /> Points Deduction Rules
          </h1>
          <p className="text-sm text-charcoal-lighter mt-1">
            Automatically deducts loyalty points when a rule&apos;s condition is met — runs hourly with no setup required. Tier-Based and Return-Abuse rules can also fire instantly on the real event.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AdminButton variant="outline" onClick={() => router.push("/admin/points-deduction-rules/activity")}>
            <History className="h-3.5 w-3.5" /> Engine Activity Log
          </AdminButton>
          {canEdit && (
            <AdminButton variant="outline" onClick={handleRunNow} disabled={running}>
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              {running ? "Running..." : "Run Now"}
            </AdminButton>
          )}
          {canEdit && (
            <AdminButton onClick={handleSave} disabled={saving} className={cn(saved && "!bg-success hover:!bg-success")}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
            </AdminButton>
          )}
        </div>
      </div>

      {loadError && (
        <Card className="border-destructive/30"><CardContent className="py-3 text-sm text-destructive">{loadError} Your saved rules are safe — this is a display error, not data loss. Try refreshing; contact support if it persists.</CardContent></Card>
      )}
      {saveError && (
        <Card className="border-destructive/30"><CardContent className="py-3 text-sm text-destructive">{saveError}</CardContent></Card>
      )}
      {runResult && (
        <Card><CardContent className="py-3 text-sm text-charcoal-light">{runResult}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last Run</CardTitle>
        </CardHeader>
        <CardContent>
          {!lastRun ? (
            <p className="text-sm text-charcoal-lighter">
              No runs recorded yet. The scheduler runs hourly automatically — use &ldquo;Run Now&rdquo; above to trigger one immediately.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-charcoal-light">
                {new Date(lastRun.startedAt).toLocaleString()} ({lastRun.triggerSource}) — {lastRun.rulesEvaluated} rule(s), {lastRun.customersAffected} customer(s), {lastRun.totalPointsDeducted} points deducted.
              </p>
              {lastRun.summary?.errors && lastRun.summary.errors.length > 0 && (
                <p className="text-xs text-destructive">{lastRun.summary.errors.length} error(s) — see Engine Activity Log for details.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {canAdd && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add Rule</CardTitle></CardHeader>
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
      )}

      <div className="space-y-4">
        {config.items.length === 0 && (
          <Card>
            <CardContent>
              <EmptyState
                icon={ShieldMinus}
                title="No rules yet"
                description="Nothing will be deducted until you add and enable at least one rule."
              />
            </CardContent>
          </Card>
        )}

        {config.items.map((item) => {
          const meta = TYPE_META[item.type];
          const Icon = meta.icon;
          const errors = ruleErrors[item.id] || [];
          const collapsed = collapsedIds.has(item.id);
          const isInstant = (item.type === "tier_based" || item.type === "return_abuse") && item.instant;
          return (
            <Card key={item.id} className={cn(errors.length > 0 && "border-destructive/40")}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <button type="button" onClick={() => toggleCollapsed(item.id)} className="flex items-center gap-3 min-w-0 text-left flex-1 active:scale-[0.99] transition-transform">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light shrink-0"><Icon className="h-4 w-4 text-secondary" /></div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      {item.name || meta.label}
                      {isInstant && <Badge className="text-[10px] bg-secondary/10 text-secondary gap-0.5"><Zap className="h-2.5 w-2.5" /> Instant</Badge>}
                    </CardTitle>
                    <CardDescription className="text-xs">{meta.description}</CardDescription>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-charcoal-lighter shrink-0 ml-auto transition-transform duration-200", collapsed && "-rotate-90")} />
                </button>
                <div className="flex items-center gap-1 shrink-0 pl-2">
                  <Switch checked={item.enabled} onCheckedChange={(v) => updateItem(item.id, { enabled: v })} disabled={!canEdit} />
                  {canDelete && (
                    <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-md text-charcoal-lighter/50 hover:text-destructive hover:bg-destructive/5 transition-colors active:scale-[0.96]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>
              {!collapsed && (
                <CardContent className="space-y-3">
                  {errors.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 space-y-0.5">
                      {errors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
                    </div>
                  )}
                  <RuleEditor rule={item} tiers={tiers} onChange={(patch) => updateItem(item.id, patch)} canEdit={canEdit} />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
