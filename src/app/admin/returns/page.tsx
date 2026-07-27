"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  RotateCcw, Clock, CheckCircle2, Truck, PackageCheck, Package, XCircle, Loader2,
  Wallet, Repeat, Settings2, Plus, Trash2, ShoppingCart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency, formatDateShort } from "@/lib/utils";
import { useAdmin } from "@/contexts/admin-context";

interface ReturnRow {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_id: string | null;
  reason: string;
  reason_label?: string | null;
  description?: string | null;
  images?: string[];
  status: string;
  resolution?: string | null;
  refund_amount?: number | null;
  reversals_applied?: boolean | number;
  admin_note?: string | null;
  items?: { name?: string; qty?: number; unit_price?: number }[];
  created_at: string;
}

const STATUS_META: Record<string, { label: string; variant: "warning" | "secondary" | "success" | "destructive" | "default"; icon: typeof Clock }> = {
  requested: { label: "Requested", variant: "warning", icon: Clock },
  approved: { label: "Approved", variant: "secondary", icon: CheckCircle2 },
  pickup_scheduled: { label: "Pickup Scheduled", variant: "secondary", icon: Truck },
  received: { label: "Product Received", variant: "secondary", icon: PackageCheck },
  refund_in_progress: { label: "Refund in Progress", variant: "secondary", icon: Wallet },
  refunded: { label: "Refunded", variant: "success", icon: CheckCircle2 },
  exchange_in_progress: { label: "Exchange in Progress", variant: "secondary", icon: Repeat },
  exchange_shipped: { label: "Replacement Shipped", variant: "secondary", icon: Truck },
  exchange_delivered: { label: "Replacement Delivered", variant: "success", icon: PackageCheck },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
};

const IN_PROGRESS = new Set(["approved", "pickup_scheduled", "received", "refund_in_progress", "exchange_in_progress", "exchange_shipped"]);

export default function AdminReturnsPage() {
  const { can } = useAdmin();
  const canManage = can("returns", "approve");

  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Reasons/window config manager
  const [cfgOpen, setCfgOpen] = useState(false);
  const [reasons, setReasons] = useState<{ code: string; label: string; enabled: boolean }[]>([]);
  const [windowDays, setWindowDays] = useState(7);
  const [cfgSaving, setCfgSaving] = useState(false);

  const load = () => {
    fetch("/api/returns")
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const loadConfig = () => {
    fetch("/api/returns/config").then((r) => r.json()).then((c) => {
      if (c?.reasons) setReasons(c.reasons);
      if (c?.windowDays) setWindowDays(c.windowDays);
    }).catch(() => {});
  };

  const act = async (id: string, payload: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/returns/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error || "Action failed"); return; }
      load();
    } finally { setBusyId(null); }
  };

  const saveConfig = async () => {
    setCfgSaving(true);
    try {
      const res = await fetch("/api/returns/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reasons, windowDays }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Save failed"); return; }
      setCfgOpen(false);
    } finally { setCfgSaving(false); }
  };

  const stats = useMemo(() => ({
    requested: rows.filter((r) => r.status === "requested").length,
    inProgress: rows.filter((r) => IN_PROGRESS.has(r.status)).length,
    refunded: rows.filter((r) => r.status === "refunded").length,
    exchanged: rows.filter((r) => r.status === "exchange_delivered").length,
    refundValue: rows.filter((r) => r.status === "refunded").reduce((s, r) => s + (Number(r.refund_amount) || 0), 0),
  }), [rows]);

  const filtered = filter === "all" ? rows
    : filter === "in_progress" ? rows.filter((r) => IN_PROGRESS.has(r.status))
    : rows.filter((r) => r.status === filter);

  const filterTabs = [
    { id: "all", label: "All", count: rows.length },
    { id: "requested", label: "Requested", count: stats.requested },
    { id: "in_progress", label: "In Progress", count: stats.inProgress },
    { id: "refunded", label: "Refunded", count: stats.refunded },
    { id: "rejected", label: "Rejected", count: rows.filter((r) => r.status === "rejected").length },
  ];

  const statTiles = [
    { label: "Requested", value: stats.requested, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
    { label: "In Progress", value: stats.inProgress, icon: RotateCcw, color: "text-secondary", bg: "bg-secondary/10" },
    { label: "Refunded", value: stats.refunded, icon: Wallet, color: "text-success", bg: "bg-success/10" },
    { label: "Exchanged", value: stats.exchanged, icon: Repeat, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Refund Value", value: formatCurrency(stats.refundValue), icon: Wallet, color: "text-gold", bg: "bg-gold/10" },
  ];

  // Stage-appropriate action buttons for a return.
  const actionsFor = (r: ReturnRow) => {
    if (!canManage) return null;
    const busy = busyId === r.id;
    const spin = <Loader2 className="h-3 w-3 mr-1 animate-spin" />;
    switch (r.status) {
      case "requested":
        return (
          <>
            <AdminButton size="sm" disabled={busy} onClick={() => act(r.id, { status: "approved" })}>{busy ? spin : <CheckCircle2 className="h-3 w-3 mr-1" />}Approve</AdminButton>
            <AdminButton variant="outline" size="sm" className="text-destructive border-destructive/30" disabled={busy} onClick={() => { const note = prompt("Rejection reason (optional):") ?? undefined; act(r.id, { status: "rejected", admin_note: note }); }}>Reject</AdminButton>
          </>
        );
      case "approved":
        return (
          <>
            {!r.reversals_applied && <AdminButton variant="outline" size="sm" disabled={busy} onClick={() => act(r.id, { action: "apply_reversals" })}>{busy ? spin : <Wallet className="h-3 w-3 mr-1" />}Apply Reversals</AdminButton>}
            <AdminButton variant="outline" size="sm" disabled={busy} onClick={() => act(r.id, { status: "pickup_scheduled" })}><Truck className="h-3 w-3 mr-1" />Schedule Pickup</AdminButton>
            <AdminButton size="sm" disabled={busy} onClick={() => act(r.id, { status: "received" })}><PackageCheck className="h-3 w-3 mr-1" />Mark Received</AdminButton>
          </>
        );
      case "pickup_scheduled":
        return <AdminButton size="sm" disabled={busy} onClick={() => act(r.id, { status: "received" })}>{busy ? spin : <PackageCheck className="h-3 w-3 mr-1" />}Mark Received</AdminButton>;
      case "received":
        return (
          <>
            <AdminButton size="sm" disabled={busy} onClick={() => act(r.id, { status: "refund_in_progress" })}><Wallet className="h-3 w-3 mr-1" />Refund</AdminButton>
            <AdminButton variant="outline" size="sm" disabled={busy} onClick={() => act(r.id, { status: "exchange_in_progress" })}><Repeat className="h-3 w-3 mr-1" />Exchange</AdminButton>
          </>
        );
      case "refund_in_progress":
        return (
          <>
            {!r.reversals_applied && <AdminButton variant="outline" size="sm" disabled={busy} onClick={() => act(r.id, { action: "apply_reversals" })}>{busy ? spin : <Wallet className="h-3 w-3 mr-1" />}Apply Reversals</AdminButton>}
            <AdminButton size="sm" disabled={busy || !r.reversals_applied} onClick={() => act(r.id, { status: "refunded" })} title={!r.reversals_applied ? "Apply reversals first" : undefined}><CheckCircle2 className="h-3 w-3 mr-1" />Mark Refunded</AdminButton>
          </>
        );
      case "exchange_in_progress":
        return <AdminButton size="sm" disabled={busy} onClick={() => act(r.id, { status: "exchange_shipped" })}>{busy ? spin : <Truck className="h-3 w-3 mr-1" />}Mark Shipped</AdminButton>;
      case "exchange_shipped":
        return <AdminButton size="sm" disabled={busy} onClick={() => act(r.id, { status: "exchange_delivered" })}>{busy ? spin : <PackageCheck className="h-3 w-3 mr-1" />}Mark Delivered</AdminButton>;
      default:
        return null;
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 text-secondary animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Returns & Refunds</h1>
          <p className="text-sm text-charcoal-lighter">Review returns, process refunds and exchanges</p>
        </div>
        {canManage && (
          <AdminButton variant="outline" size="sm" onClick={() => { loadConfig(); setCfgOpen(true); }}>
            <Settings2 className="h-3.5 w-3.5" /> Reasons & Window
          </AdminButton>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {statTiles.map((s) => (
          <Card key={s.label} className="transition-shadow duration-200 hover:shadow-[var(--shadow-card-hover)]"><CardContent className="p-3 flex items-center gap-2.5">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", s.bg)}><s.icon className={cn("h-3.5 w-3.5", s.color)} /></div>
            <div><p className="text-base font-bold text-charcoal leading-tight [font-variant-numeric:tabular-nums]">{s.value}</p><p className="text-[9px] text-charcoal-lighter">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {filterTabs.map((t) => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all active:scale-[0.96]",
              filter === t.id ? "bg-charcoal !text-white" : "bg-pearl text-charcoal-lighter hover:text-charcoal")}>
            {t.label}<span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", filter === t.id ? "bg-white/20" : "bg-white")}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={RotateCcw} title="No returns" description="Return requests will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => {
            const meta = STATUS_META[r.status] || { label: r.status, variant: "secondary" as const, icon: RotateCcw };
            const open = expanded === r.id;
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="font-mono font-bold text-charcoal text-sm">{r.order_number}</code>
                          <Badge variant={meta.variant} className="text-[9px]"><meta.icon className="h-3 w-3 mr-1" />{meta.label}</Badge>
                          {r.resolution && <Badge variant="outline" className="text-[9px] capitalize">{r.resolution}</Badge>}
                          {r.reversals_applied ? <Badge variant="secondary" className="text-[9px]">Reversals applied</Badge> : null}
                        </div>
                        <p className="text-xs text-charcoal-lighter mt-1">
                          {r.customer_name} · {r.reason_label || r.reason} · {formatDateShort(r.created_at)}
                          {r.refund_amount ? <> · <span className="text-charcoal font-medium">{formatCurrency(Number(r.refund_amount))}</span></> : null}
                        </p>
                      </div>
                      <button onClick={() => setExpanded(open ? null : r.id)} className="text-xs text-secondary hover:underline shrink-0">{open ? "Hide" : "Details"}</button>
                    </div>

                    {open && (
                      <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
                        {r.items && r.items.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-charcoal-lighter mb-1">Items</p>
                            <div className="space-y-1">
                              {r.items.map((it, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm text-charcoal-light">
                                  <ShoppingCart className="h-3.5 w-3.5 text-charcoal-lighter shrink-0" />
                                  <span className="truncate">{it.name}{it.qty ? ` ×${it.qty}` : ""}</span>
                                  {it.unit_price ? <span className="ml-auto text-charcoal-lighter [font-variant-numeric:tabular-nums]">{formatCurrency((it.unit_price || 0) * (it.qty || 1))}</span> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {r.description && <p className="text-sm text-charcoal-light italic">&ldquo;{r.description}&rdquo;</p>}
                        {r.images && r.images.length > 0 && (
                          <div className="flex gap-2">
                            {r.images.map((url, idx) => (
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/30 bg-pearl shrink-0">
                                <Image src={url} alt={`Defect photo ${idx + 1}`} fill className="object-cover" sizes="64px" unoptimized={url.includes("/uploads/")} />
                              </a>
                            ))}
                          </div>
                        )}
                        {r.admin_note && <p className="text-xs text-charcoal-lighter">Note: {r.admin_note}</p>}
                      </div>
                    )}

                    {/* Actions */}
                    {actionsFor(r) && <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/30">{actionsFor(r)}</div>}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reasons & Window config */}
      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-secondary" /> Return Settings</DialogTitle>
            <DialogDescription>Configure the reasons customers can pick and the return window.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            <div>
              <Input label="Return window (days from delivery)" type="number" min={1} value={windowDays || ""} onChange={(e) => setWindowDays(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-charcoal-light">Return reasons</label>
                <AdminButton size="xs" variant="outline" onClick={() => setReasons((p) => [...p, { code: "", label: "", enabled: true }])}><Plus className="h-3 w-3" /> Add</AdminButton>
              </div>
              <div className="space-y-2">
                {reasons.map((rs, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input placeholder="Label shown to customers" value={rs.label} onChange={(e) => setReasons((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value, code: x.code || e.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_") } : x))} className="flex-1" />
                    <Switch checked={rs.enabled} onCheckedChange={(v) => setReasons((p) => p.map((x, i) => i === idx ? { ...x, enabled: v } : x))} />
                    <button onClick={() => setReasons((p) => p.filter((_, i) => i !== idx))} className="text-charcoal-lighter hover:text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-charcoal-lighter mt-1.5">Disabled reasons stay on past returns but no longer appear in the customer form.</p>
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <AdminButton variant="ghost" size="sm" onClick={() => setCfgOpen(false)}>Cancel</AdminButton>
            <AdminButton size="sm" onClick={saveConfig} disabled={cfgSaving}>{cfgSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
