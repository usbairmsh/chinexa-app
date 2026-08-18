"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Plus, Search, Printer, Eye, Trash2, MoreHorizontal, Loader2,
  CheckCircle2, Ban, Send, Wallet,
} from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { useAdmin } from "@/contexts/admin-context";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";

interface InvoiceRow {
  id: string;
  voucher_no: string;
  order_number: string | null;
  status: "draft" | "published" | "paid" | "void";
  customer_name: string;
  customer_phone: string | null;
  total: string | number;
  affects_inventory: boolean;
  payment_method: string | null;
  paid_at: string | null;
  created_by_name: string | null;
  created_at: string;
}

const STATUS: Record<string, { label: string; variant: "warning" | "secondary" | "success" | "destructive" }> = {
  draft: { label: "Draft", variant: "warning" },
  published: { label: "Published", variant: "secondary" },
  paid: { label: "Paid", variant: "success" },
  void: { label: "Void", variant: "destructive" },
};

export default function InvoiceRegisterPage() {
  const router = useRouter();
  const { can } = useAdmin();
  const canAdd = can("accounting", "add");
  const canEdit = can("accounting", "edit");
  const canDelete = can("accounting", "delete");

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [voidTarget, setVoidTarget] = useState<InvoiceRow | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), page_size: "20" });
      if (search.trim()) qs.set("search", search.trim());
      if (status !== "all") qs.set("status", status);
      const res = await fetch(`/api/manual-invoices?${qs}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setRows(json.data || []);
        setStats(json.stats || {});
        setTotalPages(json.total_pages || 1);
      }
    } catch { /* surfaced by the empty state */ } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const print = (inv: InvoiceRow) => window.open(`/invoice?id=${encodeURIComponent(inv.id)}&type=manual`, "_blank");

  const changeStatus = async (inv: InvoiceRow, to: string, extra: Record<string, unknown> = {}) => {
    setBusyId(inv.id);
    setError("");
    try {
      const res = await fetch(`/api/manual-invoices/${inv.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Insufficient stock needs an explicit, undoable-safe decision. Rather
        // than duplicate that dialog here, send the admin to the detail view
        // which owns it — marking paid is irreversible, so it must never hinge
        // on a browser confirm where dismissing commits the action.
        if (json.error === "insufficient_stock") {
          router.push(`/admin/invoices/${inv.id}?stock=short`);
          return;
        }
        setError(json.error || "Could not update the invoice");
        return;
      }
      await load();
    } catch {
      setError("Network error — the invoice was not updated");
    } finally {
      setBusyId("");
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await fetch(`/api/manual-invoices/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Could not delete"); return; }
      setDeleteTarget(null);
      await load();
    } finally { setBusyId(""); }
  };

  const doVoid = async () => {
    if (!voidTarget) return;
    await changeStatus(voidTarget, "void", { void_reason: voidReason });
    setVoidTarget(null);
    setVoidReason("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-charcoal flex items-center gap-2">
            <FileText className="h-5 w-5 text-secondary" /> Invoices
          </h1>
          <p className="text-xs text-charcoal-lighter mt-1">
            Raise an invoice directly — for a walk-in, a social-media sale, or a quotation.
          </p>
        </div>
        {canAdd && (
          <AdminButton onClick={() => router.push("/admin/invoices/new")}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Invoice
          </AdminButton>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "All invoices", value: String(stats.count_all ?? 0), icon: FileText, tone: "text-secondary bg-secondary/10" },
          { label: "Drafts", value: String(stats.count_draft ?? 0), icon: FileText, tone: "text-warning bg-warning/10" },
          { label: "Paid", value: String(stats.count_paid ?? 0), icon: CheckCircle2, tone: "text-success bg-success/10" },
          { label: "Accountable value", value: formatCurrency(Number(stats.accountable_total) || 0), icon: Wallet, tone: "text-gold bg-gold/10" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg mb-2", s.tone)}>
                <s.icon className="h-4 w-4" />
              </div>
              <p className="font-heading text-xl font-bold text-charcoal">{s.value}</p>
              <p className="text-[11px] text-charcoal-lighter">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-lighter" />
          <Input
            className="pl-9 h-10"
            placeholder="Search voucher, order no, customer or phone"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44 h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Register */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Create your first manual invoice to see it here." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Voucher", "Customer", "Total", "Status", "Accounting", "Created", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-charcoal-lighter">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/40 hover:bg-pearl/40 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => router.push(`/admin/invoices/${inv.id}`)} className="font-medium text-charcoal hover:text-secondary transition-colors">
                        {inv.voucher_no}
                      </button>
                      {inv.order_number && <p className="text-[11px] text-charcoal-lighter">Ref {inv.order_number}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-charcoal truncate max-w-[180px]">{inv.customer_name}</p>
                      {inv.customer_phone && <p className="text-[11px] text-charcoal-lighter">{inv.customer_phone}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(Number(inv.total))}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS[inv.status]?.variant || "secondary"} className="text-[10px]">{STATUS[inv.status]?.label || inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[11px]", inv.affects_inventory ? "text-success" : "text-charcoal-lighter")}>
                        {inv.affects_inventory ? "Included" : "Excluded"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-charcoal-lighter">
                      {formatDateShort(inv.created_at)}
                      {inv.created_by_name && <><br />{inv.created_by_name}</>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <AdminButton variant="ghost" size="xs" disabled={busyId === inv.id}>
                            {busyId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                          </AdminButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/admin/invoices/${inv.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => print(inv)}>
                            <Printer className="h-3.5 w-3.5 mr-2" /> Print
                          </DropdownMenuItem>
                          {canEdit && inv.status === "draft" && (
                            <DropdownMenuItem onClick={() => changeStatus(inv, "published")}>
                              <Send className="h-3.5 w-3.5 mr-2" /> Publish
                            </DropdownMenuItem>
                          )}
                          {canEdit && inv.status === "published" && (
                            <DropdownMenuItem onClick={() => changeStatus(inv, "paid", { payment_method: "cash" })}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Mark as paid
                            </DropdownMenuItem>
                          )}
                          {canEdit && inv.status === "published" && (
                            <DropdownMenuItem onClick={() => { setVoidTarget(inv); setVoidReason(""); }}>
                              <Ban className="h-3.5 w-3.5 mr-2" /> Void
                            </DropdownMenuItem>
                          )}
                          {canDelete && inv.status === "draft" && (
                            <DropdownMenuItem onClick={() => setDeleteTarget(inv)} className="text-destructive">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete draft
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center"><Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} /></div>
      )}

      {/* Delete draft */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.voucher_no} will be removed permanently. Only drafts can be deleted — published invoices are voided instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={doDelete} disabled={!!busyId}>Delete</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void published */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => { if (!o) setVoidTarget(null); }}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Void {voidTarget?.voucher_no}?</DialogTitle>
            <DialogDescription>
              The invoice stays in the register for audit but is excluded from all figures. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Input placeholder="Reason (optional)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setVoidTarget(null)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={doVoid} disabled={!!busyId}>Void invoice</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
