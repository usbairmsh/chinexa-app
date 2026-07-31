"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldMinus, Clock, Hourglass, TrendingDown, Crown, RotateCcw,
  Plus, Trash2, Save, Loader2, PlayCircle, History, Zap, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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

/** Concise one-line summary of a rule's condition for the read-only list. */
function ruleSummary(rule: DeductionRule, tiers: Tier[]): string {
  switch (rule.type) {
    case "inactivity": return `No order in ${rule.inactiveDays} days → deduct ${rule.deductionAmount} pts`;
    case "points_expiry": return `Expire points older than ${rule.expiryDays} days`;
    case "low_spend": return `Under ৳${rule.minSpendThreshold} in ${rule.windowDays} days → deduct ${rule.deductionAmount} pts`;
    case "tier_based": {
      const names = rule.tierIds.map((id) => tiers.find((t) => t.id === id)?.name || id).join(", ") || "no tiers";
      return `Tiers: ${names} → deduct ${rule.deductionAmount} pts`;
    }
    case "return_abuse": return `≥${rule.minOrders} orders & ${rule.returnRateThresholdPct}% returned → deduct ${rule.deductionAmount} pts`;
  }
}

function RuleEditor({ rule, tiers, onChange }: { rule: DeductionRule; tiers: Tier[]; onChange: (patch: Partial<DeductionRule>) => void }) {
  const p = (patch: Partial<DeductionRule>) => onChange(patch);
  const meta = TYPE_META[rule.type];

  return (
    <div className="space-y-4">
      <Input label="Rule Name" value={rule.name} onChange={(e) => p({ name: e.target.value })} placeholder="e.g. Inactive 90+ days" required />

      {rule.type === "inactivity" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Inactive For" hint="Days since their last order (or since signup if they never ordered)." value={rule.inactiveDays} onChange={(v) => p({ inactiveDays: v } as Partial<DeductionRule>)} suffix="days since last order" required />
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" required />
        </div>
      )}

      {rule.type === "points_expiry" && (
        <NumField label="Expire Points Older Than" hint="Age at which earned points become eligible to expire. The amount expired is always computed live — whatever qualifies, capped at the customer's current balance." value={rule.expiryDays} onChange={(v) => p({ expiryDays: v } as Partial<DeductionRule>)} suffix="days" required />
      )}

      {rule.type === "low_spend" && (
        <div className="grid sm:grid-cols-3 gap-3">
          <NumField label="Spend Window" hint="Rolling period their spend is measured over." value={rule.windowDays} onChange={(v) => p({ windowDays: v } as Partial<DeductionRule>)} suffix="days" required />
          <NumField label="Minimum Spend" hint="Threshold below which the rule applies." value={rule.minSpendThreshold} onChange={(v) => p({ minSpendThreshold: v } as Partial<DeductionRule>)} suffix="৳ in window" required />
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" required />
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
                    onClick={() => p({ tierIds: selected ? rule.tierIds.filter((id) => id !== t.id) : [...rule.tierIds, t.id] } as Partial<DeductionRule>)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-[0.96]", selected ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter")}
                  >
                    {t.name}
                  </button>
                );
              })}
              {tiers.length === 0 && <p className="text-xs text-charcoal-lighter">No membership tiers found.</p>}
            </div>
          </div>
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" required />
        </div>
      )}

      {rule.type === "return_abuse" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Minimum Orders" hint="Rule only applies once a customer has at least this many orders." value={rule.minOrders} onChange={(v) => p({ minOrders: v } as Partial<DeductionRule>)} suffix="before this rule can apply" required />
          <NumField label="Return Rate Threshold" hint="Percentage of orders returned that triggers this rule." value={rule.returnRateThresholdPct} onChange={(v) => p({ returnRateThresholdPct: v } as Partial<DeductionRule>)} suffix="% of orders returned" required />
          <NumField label="Deduct" hint="Points taken from a matching customer." value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" required />
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
          <Switch checked={rule.instant} onCheckedChange={(v) => p({ instant: v } as Partial<DeductionRule>)} />
        </div>
      )}
      {!meta.instantEligible && (
        <p className="text-[11px] text-charcoal-lighter flex items-center gap-1">
          <FieldLabel label="No instant option" hint="This rule type is based on drift over time (inactivity/expiry) or a direction that can't newly trigger a violation from a single event, so it's only checked on the hourly schedule." />
        </p>
      )}

      <div className="pt-2 border-t border-border/30 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox checked={rule.advancedEnabled} onCheckedChange={(v) => p({ advancedEnabled: v === true } as Partial<DeductionRule>)} />
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
                required
              />
            )}
            <Input
              label={<FieldLabel label="Notification Title" hint="Headline the customer sees when this rule deducts their points." required />}
              value={rule.notificationTitle}
              onChange={(e) => p({ notificationTitle: e.target.value } as Partial<DeductionRule>)}
              required
            />
            <Textarea
              label={<FieldLabel label="Notification Message" hint="Body text the customer sees. Supports {points} and {rule} tokens." required />}
              value={rule.notificationMessage}
              onChange={(e) => p({ notificationMessage: e.target.value } as Partial<DeductionRule>)}
              className="min-h-[60px]"
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
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>("");
  const [saveError, setSaveError] = useState<string>("");
  const [loadError, setLoadError] = useState<string>("");
  const [lastRun, setLastRun] = useState<LastRun | null>(null);

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addType, setAddType] = useState<DeductionRuleType>("inactivity");
  const [draft, setDraft] = useState<DeductionRule | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = creating
  const [modalErrors, setModalErrors] = useState<string[]>([]);
  const [modalSaving, setModalSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setLoadError("");
    Promise.all([
      fetch("/api/admin/points-deduction").then((r) => r.json()).catch(() => null),
      fetch("/api/membership/tiers").then((r) => r.json()).catch(() => []),
    ])
      .then(([data, tiersData]) => {
        if (data?.error) {
          setLoadError(`Couldn't load rules: ${data.error}`);
          return;
        }
        if (data?.config) setConfig(data.config);
        if (data?.lastRun) setLastRun(data.lastRun);
        if (Array.isArray(tiersData)) setTiers(tiersData.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** Persist a new items array to the server. Returns true on success. */
  const persist = async (items: DeductionRule[]): Promise<boolean> => {
    setSaveError("");
    const next = { ...config, items };
    try {
      const res = await fetch("/api/admin/points-deduction", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      setConfig(next);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed — please try again.");
      return false;
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(makeDefault(addType));
    setModalErrors([]);
    setDialogOpen(true);
  };

  // Re-seed the draft when the add-type changes while creating.
  useEffect(() => {
    if (dialogOpen && editingId === null) setDraft(makeDefault(addType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addType]);

  const openEdit = (rule: DeductionRule) => {
    setEditingId(rule.id);
    setDraft({ ...rule });
    setModalErrors([]);
    setDialogOpen(true);
  };

  const saveDraft = async () => {
    if (!draft) return;
    const errors = validateRule(draft);
    if (errors.length) { setModalErrors(errors); return; }
    setModalSaving(true);
    const items = editingId
      ? config.items.map((i) => (i.id === editingId ? draft : i))
      : [...config.items, draft];
    const ok = await persist(items);
    setModalSaving(false);
    if (ok) setDialogOpen(false);
    else setModalErrors([saveError || "Save failed — please try again."]);
  };

  const toggleEnabled = async (rule: DeductionRule) => {
    setTogglingId(rule.id);
    await persist(config.items.map((i) => (i.id === rule.id ? { ...i, enabled: !i.enabled } : i)));
    setTogglingId(null);
  };

  const removeRule = async (rule: DeductionRule) => {
    if (!confirm(`Delete the rule "${rule.name || TYPE_META[rule.type].label}"? This cannot be undone.`)) return;
    await persist(config.items.filter((i) => i.id !== rule.id));
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
          {canAdd && (
            <AdminButton onClick={openCreate}><Plus className="h-3.5 w-3.5" /> New Rule</AdminButton>
          )}
        </div>
      </div>

      {loadError && (
        <Card className="border-destructive/30"><CardContent className="py-3 text-sm text-destructive">{loadError} Your saved rules are safe — this is a display error, not data loss. Try refreshing; contact support if it persists.</CardContent></Card>
      )}
      {saveError && !dialogOpen && (
        <Card className="border-destructive/30"><CardContent className="py-3 text-sm text-destructive">{saveError}</CardContent></Card>
      )}
      {runResult && (
        <Card><CardContent className="py-3 text-sm text-charcoal-light">{runResult}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Last Run</CardTitle></CardHeader>
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

      {/* Read-only rules list — edit / on-off / delete per row */}
      <div className="space-y-3">
        {config.items.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={ShieldMinus}
                title="No rules yet"
                description="Nothing will be deducted until you add and enable at least one rule."
                actionLabel={canAdd ? "New Rule" : undefined}
                onAction={canAdd ? openCreate : undefined}
              />
            </CardContent>
          </Card>
        ) : (
          config.items.map((item) => {
            const meta = TYPE_META[item.type];
            const Icon = meta.icon;
            const instant = (item.type === "tier_based" || item.type === "return_abuse") && item.instant;
            return (
              <Card key={item.id} className={cn(!item.enabled && "opacity-70")}>
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light shrink-0"><Icon className="h-4.5 w-4.5 text-secondary" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-charcoal truncate">{item.name || meta.label}</p>
                      <Badge className="text-[10px] bg-pearl text-charcoal-lighter">{meta.label}</Badge>
                      {instant && <Badge className="text-[10px] bg-secondary/10 text-secondary gap-0.5"><Zap className="h-2.5 w-2.5" /> Instant</Badge>}
                      {!item.enabled && <Badge className="text-[10px] bg-charcoal-lighter/10 text-charcoal-lighter">Off</Badge>}
                    </div>
                    <p className="text-xs text-charcoal-lighter mt-0.5 truncate">{ruleSummary(item, tiers)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canEdit && (
                      togglingId === item.id
                        ? <Loader2 className="h-4 w-4 animate-spin text-charcoal-lighter mr-1" />
                        : <Switch checked={item.enabled} onCheckedChange={() => toggleEnabled(item)} />
                    )}
                    {canEdit && (
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-charcoal-lighter hover:text-secondary hover:bg-secondary/5 transition-colors active:scale-[0.96]" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => removeRule(item)} className="p-1.5 rounded-md text-charcoal-lighter/60 hover:text-destructive hover:bg-destructive/5 transition-colors active:scale-[0.96]" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit modal */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o && !modalSaving) setDialogOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldMinus className="h-5 w-5 text-secondary" /> {editingId ? "Edit Rule" : "New Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "Update this deduction rule's condition and notification." : "Choose a rule type and set its condition. It saves immediately."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-1">
            {editingId === null && (
              <div>
                <label className="block text-sm font-medium text-charcoal-light mb-1.5"><FieldLabel label="Rule Type" /></label>
                <Select value={addType} onValueChange={(v) => setAddType(v as DeductionRuleType)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_META) as DeductionRuleType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_META[t].label} — {TYPE_META[t].description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft && <RuleEditor rule={draft} tiers={tiers} onChange={(patch) => { setDraft((d) => (d ? ({ ...d, ...patch } as DeductionRule) : d)); if (modalErrors.length) setModalErrors([]); }} />}

            {modalErrors.length > 0 && (
              <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 space-y-0.5">
                {modalErrors.map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
              </div>
            )}
          </div>

          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDialogOpen(false)} disabled={modalSaving}>Cancel</AdminButton>
            <AdminButton onClick={saveDraft} disabled={modalSaving}>
              {modalSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving...</> : <><Save className="h-3.5 w-3.5 mr-1" /> {editingId ? "Save Changes" : "Create Rule"}</>}
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
