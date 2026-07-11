"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronRight, Loader2, AlertTriangle, Undo2, Gift, X, Check, Zap, Clock, PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { cn, formatDate } from "@/lib/utils";

interface ActivityEntry {
  runId: string;
  ruleId: string;
  ruleName: string;
  ruleType: string;
  triggerSource: string;
  ranAt: string;
  candidates: number;
  customersAffected: number;
  errorCount: number;
  pointsDeducted: number;
}

interface CustomerRow {
  id: string;
  runId: string;
  ruleId: string;
  ruleName: string;
  ruleType: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  outcome: "deducted" | "skipped_no_balance" | "error";
  pointsDeducted: number;
  matchedCriteria: string;
  errorMessage: string | null;
  createdAt: string;
  reversedAt: string | null;
  disbursedAt: string | null;
}

const OUTCOME_META: Record<CustomerRow["outcome"], { label: string; className: string }> = {
  deducted: { label: "Deducted", className: "bg-destructive/10 text-destructive" },
  skipped_no_balance: { label: "Skipped — no balance", className: "bg-pearl text-charcoal-lighter" },
  error: { label: "Error", className: "bg-warning/10 text-warning" },
};

const TRIGGER_META: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  scheduled: { label: "Scheduled", icon: Clock, className: "bg-pearl text-charcoal-lighter" },
  manual: { label: "Manual", icon: PlayCircle, className: "bg-secondary/10 text-secondary" },
  instant: { label: "Instant", icon: Zap, className: "bg-warning/10 text-warning" },
};

function DisburseDialog({ row, onClose, onDone }: { row: CustomerRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(row.pointsDeducted || ""));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/points-deduction/activity-row/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disburse", amount: Number(amount) || undefined, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to disburse");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disburse");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-charcoal">Disburse Points</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-pearl"><X className="h-4 w-4 text-charcoal-lighter" /></button>
        </div>
        <p className="text-sm text-charcoal-lighter">
          Credit points to <span className="font-medium text-charcoal">{row.customerName}</span> for this row. Defaults to the amount originally deducted.
        </p>
        <Input label="Amount (points)" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason shown in the ledger" />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <AdminButton variant="ghost" onClick={onClose}>Cancel</AdminButton>
          <AdminButton onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
            {submitting ? "Disbursing..." : "Disburse"}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

export default function EngineActivityLogPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ActivityEntry | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [rowActionError, setRowActionError] = useState("");
  const [disburseTarget, setDisburseTarget] = useState<CustomerRow | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const fetchEntries = () => {
    setLoading(true);
    setLoadError("");
    fetch("/api/admin/points-deduction/activity")
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) { setLoadError(`Couldn't load the activity log: ${data.error}`); return; }
        setEntries(Array.isArray(data?.entries) ? data.entries : []);
      })
      .catch(() => setLoadError("Couldn't load the activity log — check your connection and try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEntries(); }, []);

  const openEntry = (entry: ActivityEntry) => {
    setSelected(entry);
    setCustomers([]);
    setRowActionError("");
    setCustomersLoading(true);
    fetch(`/api/admin/points-deduction/activity/${entry.runId}/${entry.ruleId}`)
      .then((r) => r.json())
      .then((data) => setCustomers(Array.isArray(data?.customers) ? data.customers : []))
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false));
  };

  const refreshCustomers = () => { if (selected) openEntry(selected); };

  const handleCancel = async (row: CustomerRow) => {
    setRowActionError("");
    setCancellingId(row.id);
    try {
      const res = await fetch(`/api/admin/points-deduction/activity-row/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to cancel");
      refreshCustomers();
    } catch (err) {
      setRowActionError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/admin/points-deduction-rules")} className="p-2 rounded-lg hover:bg-pearl">
          <ArrowLeft className="h-4 w-4 text-charcoal-lighter" />
        </button>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Engine Activity Log</h1>
          <p className="text-sm text-charcoal-lighter mt-1">
            Every rule that has run — scheduled, manual, or instant. Click a row to see which customers matched, why, and to cancel or disburse points.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rule Runs</CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 text-secondary animate-spin" /></div>
          ) : loadError ? (
            <p className="text-sm text-destructive py-6 text-center">{loadError}</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-charcoal-lighter py-6 text-center">No rule runs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const trigger = TRIGGER_META[entry.triggerSource] || TRIGGER_META.scheduled;
                const TriggerIcon = trigger.icon;
                return (
                  <button
                    key={`${entry.runId}-${entry.ruleId}`}
                    onClick={() => openEntry(entry)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-colors",
                      selected?.runId === entry.runId && selected?.ruleId === entry.ruleId
                        ? "border-secondary/40 bg-secondary/5"
                        : "border-border/30 hover:bg-pearl"
                    )}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0", trigger.className)}>
                        <TriggerIcon className="h-2.5 w-2.5" /> {trigger.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-charcoal truncate">{entry.ruleName}</p>
                        <p className="text-xs text-charcoal-lighter">{formatDate(entry.ranAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-charcoal-light">
                      <span>{entry.candidates} matched</span>
                      <span>{entry.customersAffected} deducted</span>
                      <span>{entry.pointsDeducted} pts</span>
                      {entry.errorCount > 0 && (
                        <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> {entry.errorCount}</span>
                      )}
                      <ChevronRight className="h-4 w-4 text-charcoal-lighter" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected.ruleName} — Matched Customers</CardTitle>
            <CardDescription>{formatDate(selected.ranAt)}</CardDescription>
          </CardHeader>
          <CardContent>
            {rowActionError && <p className="text-xs text-destructive mb-3">{rowActionError}</p>}
            {customersLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 text-secondary animate-spin" /></div>
            ) : customers.length === 0 ? (
              <p className="text-sm text-charcoal-lighter py-6 text-center">No customer detail recorded for this run.</p>
            ) : (
              <div className="space-y-2">
                {customers.map((row) => {
                  const meta = OUTCOME_META[row.outcome];
                  return (
                    <div key={row.id} className="p-3 rounded-lg border border-border/30 space-y-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-charcoal">{row.customerName}</p>
                          {row.customerPhone && <p className="text-xs text-charcoal-lighter">{row.customerPhone}</p>}
                        </div>
                        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0", meta.className)}>{meta.label}</span>
                      </div>
                      <p className="text-xs text-charcoal-light">{row.matchedCriteria}</p>
                      {row.errorMessage && <p className="text-xs text-destructive">{row.errorMessage}</p>}
                      {row.outcome === "deducted" && (
                        <p className="text-xs text-charcoal-lighter">Deducted <span className="font-medium text-charcoal">{row.pointsDeducted} points</span></p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {row.reversedAt && (
                          <span className="flex items-center gap-1 text-[11px] text-success"><Check className="h-3 w-3" /> Reversed {formatDate(row.reversedAt)}</span>
                        )}
                        {row.disbursedAt && (
                          <span className="flex items-center gap-1 text-[11px] text-success"><Check className="h-3 w-3" /> Disbursed {formatDate(row.disbursedAt)}</span>
                        )}
                        {row.outcome === "deducted" && !row.reversedAt && (
                          <AdminButton size="xs" variant="outline" onClick={() => handleCancel(row)} disabled={cancellingId === row.id}>
                            {cancellingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                            Cancel (Refund)
                          </AdminButton>
                        )}
                        {!row.disbursedAt && (
                          <AdminButton size="xs" variant="outline" onClick={() => setDisburseTarget(row)}>
                            <Gift className="h-3 w-3" /> Disburse
                          </AdminButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {disburseTarget && (
        <DisburseDialog
          row={disburseTarget}
          onClose={() => setDisburseTarget(null)}
          onDone={() => { setDisburseTarget(null); refreshCustomers(); }}
        />
      )}
    </div>
  );
}
