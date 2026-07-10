"use client";

import { useState, useEffect } from "react";
import {
  ShieldMinus, Clock, Hourglass, TrendingDown, Repeat, Crown, RotateCcw,
  Plus, Trash2, Save, Loader2, Check, PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { cn, randomId } from "@/lib/utils";
import {
  DEFAULT_DEDUCTION_RULE_CONFIG,
  type DeductionRule, type DeductionRuleConfig, type DeductionRuleType,
} from "@/types/points-deduction-rules";

interface Tier { id: string; name: string; }

const TYPE_META: Record<DeductionRuleType, { label: string; description: string; icon: typeof Clock }> = {
  inactivity: { label: "Inactivity", description: "No order in a set number of days", icon: Clock },
  points_expiry: { label: "Points Expiry", description: "Expire points older than a set age", icon: Hourglass },
  low_spend: { label: "Low Spend", description: "Spend below a threshold within a rolling window", icon: TrendingDown },
  flat_decay: { label: "Flat Recurring Decay", description: "Deduct a fixed amount from every active customer on a schedule", icon: Repeat },
  tier_based: { label: "Tier-Based", description: "Applies only to customers currently in specific tiers", icon: Crown },
  return_abuse: { label: "Return/Refund Abuse", description: "High return rate relative to order count", icon: RotateCcw },
};

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

function NumField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-charcoal-light mb-1.5">{label}</label>
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
        <Input label="Rule Name" value={rule.name} onChange={(e) => p({ name: e.target.value })} placeholder="e.g. Inactive 90+ days" />
        <NumField label="Repeat Interval" value={rule.repeatIntervalDays} onChange={(v) => p({ repeatIntervalDays: Math.max(1, v) })} suffix="days between deductions for the same customer" />
      </div>

      {rule.type === "inactivity" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Inactive For" value={rule.inactiveDays} onChange={(v) => p({ inactiveDays: v } as Partial<DeductionRule>)} suffix="days since last order" />
          <NumField label="Deduct" value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" />
        </div>
      )}

      {rule.type === "points_expiry" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Expire Points Older Than" value={rule.expiryDays} onChange={(v) => p({ expiryDays: v } as Partial<DeductionRule>)} suffix="days" />
          <NumField label="Cap Per Run (optional)" value={rule.capAmount || 0} onChange={(v) => p({ capAmount: v || undefined } as Partial<DeductionRule>)} suffix="points, 0 = no cap" />
          <p className="sm:col-span-2 text-[11px] text-charcoal-lighter">
            The deducted amount is always computed — whatever qualifies as expired, capped at the customer&apos;s current balance (never goes negative) and the optional cap above.
          </p>
        </div>
      )}

      {rule.type === "low_spend" && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <NumField label="Spend Window" value={rule.windowDays} onChange={(v) => p({ windowDays: v } as Partial<DeductionRule>)} suffix="days" />
            <NumField label="Minimum Spend" value={rule.minSpendThreshold} onChange={(v) => p({ minSpendThreshold: v } as Partial<DeductionRule>)} suffix="৳ in window" />
            <NumField label="Deduct" value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" />
          </div>
          <p className="text-[11px] font-medium text-charcoal-lighter uppercase tracking-wide">Optional gates (leave at 0 to skip)</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <NumField label="Minimum Account Age" value={rule.requireMinAccountAgeDays || 0} onChange={(v) => p({ requireMinAccountAgeDays: v || undefined } as Partial<DeductionRule>)} suffix="days — exempts brand-new signups" />
            <NumField label="Minimum Lifetime Orders" value={rule.requireMinLifetimeOrders || 0} onChange={(v) => p({ requireMinLifetimeOrders: v || undefined } as Partial<DeductionRule>)} suffix="orders — exempts customers who never bought" />
          </div>
        </div>
      )}

      {rule.type === "flat_decay" && (
        <NumField label="Deduct" value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points from every active customer, every repeat interval" />
      )}

      {rule.type === "tier_based" && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-charcoal-light mb-1.5">Applies to Tiers</label>
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
          <NumField label="Deduct" value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" />
        </div>
      )}

      {rule.type === "return_abuse" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Minimum Orders" value={rule.minOrders} onChange={(v) => p({ minOrders: v } as Partial<DeductionRule>)} suffix="before this rule can apply" />
          <NumField label="Return Rate Threshold" value={rule.returnRateThresholdPct} onChange={(v) => p({ returnRateThresholdPct: v } as Partial<DeductionRule>)} suffix="% of orders returned" />
          <NumField label="Lookback (optional)" value={rule.lookbackDays || 0} onChange={(v) => p({ lookbackDays: v || undefined } as Partial<DeductionRule>)} suffix="days, 0 = all-time" />
          <NumField label="Deduct" value={rule.deductionAmount} onChange={(v) => p({ deductionAmount: v } as Partial<DeductionRule>)} suffix="points" />
        </div>
      )}

      <div className="pt-2 border-t border-border/30 space-y-2">
        <p className="text-[11px] font-medium text-charcoal-lighter uppercase tracking-wide">Customer Notification</p>
        <Input label="Title" value={rule.notification.title} onChange={(e) => p({ notification: { ...rule.notification, title: e.target.value } })} />
        <Textarea label="Message" value={rule.notification.message} onChange={(e) => p({ notification: { ...rule.notification, message: e.target.value } })} className="min-h-[60px]" />
        <p className="text-[11px] text-charcoal-lighter">Use <code className="px-1 py-0.5 rounded bg-pearl">{"{points}"}</code> and <code className="px-1 py-0.5 rounded bg-pearl">{"{rule}"}</code> — replaced with the actual amount deducted and this rule&apos;s name.</p>
      </div>
    </div>
  );
}

export default function AdminPointsDeductionRulesPage() {
  const [config, setConfig] = useState<DeductionRuleConfig>(DEFAULT_DEDUCTION_RULE_CONFIG);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>("");
  const [addType, setAddType] = useState<DeductionRuleType>("inactivity");

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
  }, []);

  const addItem = () => {
    setConfig((c) => ({ ...c, items: [...c.items, makeDefault(addType)] }));
  };

  const updateItem = (id: string, patch: Partial<DeductionRule>) => {
    setConfig((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? ({ ...i, ...patch } as DeductionRule) : i)) }));
  };

  const removeItem = (id: string) => {
    setConfig((c) => ({ ...c, items: c.items.filter((i) => i.id !== id) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "points_deduction_rules", value: config }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {} finally { setSaving(false); }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunResult("");
    try {
      const res = await fetch("/api/admin/points-deduction/run-now", { method: "POST" });
      const data = await res.json();
      if (data?.success) {
        setRunResult(`Evaluated ${data.rulesEvaluated} rule(s) — ${data.customersAffected} customer(s) affected, ${data.totalPointsDeducted} points deducted.`);
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
            Automatically deducts loyalty points from customer accounts when a rule&apos;s condition is met. Runs on a schedule via your server&apos;s cron — see the setup note below.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      {runResult && (
        <Card><CardContent className="py-3 text-sm text-charcoal-light">{runResult}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduling</CardTitle>
          <CardDescription>
            This app has no built-in scheduler — rules are only evaluated when something calls the cron endpoint.
            Set up an OS-level cron job on your server (e.g. hourly or daily) to call:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block text-xs bg-pearl rounded-lg p-3 overflow-x-auto whitespace-pre">
            {`curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/points-deduction`}
          </code>
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
          return (
            <Card key={item.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light shrink-0"><Icon className="h-4 w-4 text-secondary" /></div>
                  <div>
                    <CardTitle className="text-sm">{item.name || meta.label}</CardTitle>
                    <CardDescription className="text-xs">{meta.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={item.enabled} onCheckedChange={(v) => updateItem(item.id, { enabled: v })} />
                  <button onClick={() => removeItem(item.id)} className="p-1.5 rounded-md text-charcoal-lighter/50 hover:text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <RuleEditor rule={item} tiers={tiers} onChange={(patch) => updateItem(item.id, patch)} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
