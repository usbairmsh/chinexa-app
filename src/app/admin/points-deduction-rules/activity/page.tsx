"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ChevronRight, Loader2, AlertTriangle, Undo2, X, Check, Zap, Clock, PlayCircle, Trash2, Search, History, Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDate } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";

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

export default function EngineActivityLogPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { can } = useAdmin();
  const canEdit = can("points_deduction_rules", "edit");
  const canDelete = can("points_deduction_rules", "delete");
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ActivityEntry | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [rowActionError, setRowActionError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");

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
    setCustomerSearch("");
    setCustomersLoading(true);
    fetch(`/api/admin/points-deduction/activity/${entry.runId}/${entry.ruleId}`)
      .then((r) => r.json())
      .then((data) => setCustomers(Array.isArray(data?.customers) ? data.customers : []))
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false));
  };

  const closeEntry = () => { setSelected(null); setCustomers([]); setCustomerSearch(""); };

  const refreshCustomers = () => { if (selected) openEntry(selected); };

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (row) => row.customerName.toLowerCase().includes(q) || row.customerPhone.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const handleDelete = async (entry: ActivityEntry) => {
    const key = `${entry.runId}-${entry.ruleId}`;
    setDeleteError("");
    setDeletingKey(key);
    try {
      const res = await fetch(
        `/api/admin/points-deduction/activity?runId=${encodeURIComponent(entry.runId)}&ruleId=${encodeURIComponent(entry.ruleId)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete");
      setEntries((prev) => prev.filter((e) => !(e.runId === entry.runId && e.ruleId === entry.ruleId)));
      if (selected?.runId === entry.runId && selected?.ruleId === entry.ruleId) closeEntry();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingKey(null);
    }
  };

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
        <button onClick={() => router.push("/admin/points-deduction-rules")} className="p-2 rounded-lg hover:bg-pearl transition-colors active:scale-[0.96]">
          <ArrowLeft className="h-4 w-4 text-charcoal-lighter" />
        </button>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Engine Activity Log</h1>
          <p className="text-sm text-charcoal-lighter mt-1">
            Every rule that has run — scheduled, manual, or instant. Click a row to see which customers matched, why, and to refund deducted points. Use the trash icon to remove a log entry.
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
            <EmptyState
              icon={History}
              title="No rule runs recorded yet"
              description="Scheduled, manual, and instant runs will show up here once a points deduction rule executes."
            />
          ) : (
            <div className="space-y-2">
              {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
              {entries.map((entry, i) => {
                const trigger = TRIGGER_META[entry.triggerSource] || TRIGGER_META.scheduled;
                const TriggerIcon = trigger.icon;
                const key = `${entry.runId}-${entry.ruleId}`;
                return (
                  <motion.div
                    key={key}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg border transition-colors",
                      selected?.runId === entry.runId && selected?.ruleId === entry.ruleId
                        ? "border-secondary/40 bg-secondary/5"
                        : "border-border/30 hover:bg-pearl"
                    )}
                  >
                    <button onClick={() => openEntry(entry)} className="flex-1 min-w-0 flex items-center justify-between gap-3 p-3 text-left">
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0", trigger.className)}>
                          <TriggerIcon className="h-2.5 w-2.5" /> {trigger.label}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-charcoal truncate">{entry.ruleName}</p>
                          <p className="text-xs text-charcoal-lighter">{formatDate(entry.ranAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-charcoal-light [font-variant-numeric:tabular-nums]">
                        <span>{entry.candidates} matched</span>
                        <span>{entry.customersAffected} deducted</span>
                        <span className="font-semibold text-charcoal">{entry.pointsDeducted} pts</span>
                        {entry.errorCount > 0 && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium"><AlertTriangle className="h-3 w-3" /> {entry.errorCount}</span>
                        )}
                        <ChevronRight className="h-4 w-4 text-charcoal-lighter" />
                      </div>
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete this log entry for "${entry.ruleName}"? This only removes it from the activity log — any points already deducted are not affected.`)) {
                            handleDelete(entry);
                          }
                        }}
                        disabled={deletingKey === key}
                        className="p-2 mr-2 rounded-md text-charcoal-lighter/60 hover:text-destructive hover:bg-destructive/5 transition-colors shrink-0 active:scale-[0.96] disabled:active:scale-100"
                        title="Delete this log entry"
                      >
                        {deletingKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={closeEntry}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="bg-white rounded-luxury shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", damping: 26, stiffness: 400 }}
            >
              <div className="flex items-center justify-between gap-3 p-5 pb-3 shrink-0">
                <div className="min-w-0">
                  <h3 className="font-heading text-lg font-semibold text-charcoal truncate">{selected.ruleName} — Matched Customers</h3>
                  <p className="text-xs text-charcoal-lighter mt-0.5">{formatDate(selected.ranAt)}</p>
                </div>
                <button onClick={closeEntry} className="p-1.5 rounded-md hover:bg-pearl transition-colors active:scale-[0.96] shrink-0"><X className="h-4 w-4 text-charcoal-lighter" /></button>
              </div>

              {customers.length > 0 && (
                <div className="px-5 pb-3 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-lighter" />
                    <Input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search by name or phone..."
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              <div className="px-5 pb-5 overflow-y-auto flex-1">
                {rowActionError && <p className="text-xs text-destructive mb-3">{rowActionError}</p>}
                {customersLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 text-secondary animate-spin" /></div>
                ) : customers.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No customer detail recorded"
                    description="This run didn't leave a per-customer breakdown."
                    className="py-10"
                  />
                ) : filteredCustomers.length === 0 ? (
                  <p className="text-sm text-charcoal-lighter py-6 text-center">No customer matches &ldquo;{customerSearch}&rdquo;.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredCustomers.map((row, i) => {
                      const meta = OUTCOME_META[row.outcome];
                      return (
                        <motion.div
                          key={row.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i, 8) * 0.025 }}
                          className="p-3 rounded-lg border border-border/30 hover:border-secondary/20 transition-colors space-y-2"
                        >
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-charcoal">{row.customerName}</p>
                              {row.customerPhone && <p className="text-xs text-charcoal-lighter [font-variant-numeric:tabular-nums]">{row.customerPhone}</p>}
                            </div>
                            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0", meta.className)}>{meta.label}</span>
                          </div>
                          <p className="text-xs text-charcoal-light">{row.matchedCriteria}</p>
                          {row.errorMessage && <p className="text-xs text-destructive">{row.errorMessage}</p>}
                          {row.outcome === "deducted" && (
                            <p className="text-xs text-charcoal-lighter">Deducted <span className="font-semibold text-charcoal [font-variant-numeric:tabular-nums]">{row.pointsDeducted} points</span></p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            {row.reversedAt && (
                              <span className="flex items-center gap-1 text-[11px] text-success"><Check className="h-3 w-3" /> Reversed {formatDate(row.reversedAt)}</span>
                            )}
                            {row.disbursedAt && (
                              <span className="flex items-center gap-1 text-[11px] text-success"><Check className="h-3 w-3" /> Disbursed {formatDate(row.disbursedAt)}</span>
                            )}
                            {canEdit && row.outcome === "deducted" && !row.reversedAt && (
                              <AdminButton size="xs" variant="outline" onClick={() => handleCancel(row)} disabled={cancellingId === row.id}>
                                {cancellingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                                Refund
                              </AdminButton>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
