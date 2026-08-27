"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Printer, Loader2, CheckCircle2, Ban, Send, Pencil } from "lucide-react";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/contexts/admin-context";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";

interface Item {
  id: string; product_name: string; variant_name: string | null;
  quantity: number; unit_price: string | number;
  line_discount: string | number; line_total: string | number;
}
interface Invoice {
  id: string; voucher_no: string; order_number: string | null;
  status: "draft" | "published" | "paid" | "void";
  customer_name: string; customer_phone: string | null; customer_email: string | null; customer_address: string | null;
  subtotal: string | number; line_discount_total: string | number; order_discount: string | number;
  delivery_charge: string | number; total: string | number;
  affects_inventory: boolean; stock_applied: boolean; revenue_applied: boolean;
  payment_method: string | null; paid_at: string | null; published_at: string | null;
  voided_at: string | null; void_reason: string | null;
  notes: string | null; seal_url: string | null; signature_url: string | null;
  created_by_name: string | null; created_at: string;
  items: Item[];
}

const STATUS: Record<string, { label: string; variant: "warning" | "secondary" | "success" | "destructive" }> = {
  draft: { label: "Draft", variant: "warning" },
  published: { label: "Published", variant: "secondary" },
  paid: { label: "Paid", variant: "success" },
  void: { label: "Void", variant: "destructive" },
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAdmin();
  const canEdit = can("accounting", "edit");

  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [stockChoiceOpen, setStockChoiceOpen] = useState(false);
  const [shortages, setShortages] = useState<string[]>([]);
  const [pendingPayMethod, setPendingPayMethod] = useState("cash");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manual-invoices/${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json();
      setInv(res.ok && !json.error ? json : null);
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const print = () => window.open(`/invoice?id=${encodeURIComponent(id)}&type=manual`, "_blank");

  const changeStatus = async (to: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/manual-invoices/${id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Insufficient stock is a decision, not a failure. It opens a dialog with
        // two EXPLICIT choices plus a safe way out — dismissing must never mark
        // the invoice paid, because paid is terminal and cannot be undone.
        if (json.error === "insufficient_stock") {
          setShortages(json.shortages || []);
          setStockChoiceOpen(true);
          setPendingPayMethod((extra.payment_method as string) || payMethod);
          return;
        }
        setError(json.error || "Could not update the invoice");
        return;
      }
      setPayOpen(false); setVoidOpen(false);
      await load();
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" /></div>;
  if (!inv) return <div className="p-6 text-sm text-charcoal-lighter">Invoice not found.</div>;

  const s = STATUS[inv.status] || STATUS.draft;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <AdminButton variant="ghost" size="sm" onClick={() => router.push("/admin/invoices")}><ArrowLeft className="h-4 w-4" /></AdminButton>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-2xl font-bold text-charcoal">{inv.voucher_no}</h1>
            <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
            <span className={cn("text-[11px] rounded-full px-2 py-0.5", inv.affects_inventory ? "bg-success/10 text-success" : "bg-charcoal/[0.06] text-charcoal-lighter")}>
              {inv.affects_inventory ? "In accounting" : "Excluded from accounting"}
            </span>
          </div>
          {inv.order_number && <p className="text-xs text-charcoal-lighter mt-0.5">Order reference: {inv.order_number}</p>}
        </div>
        <div className="flex items-center gap-2">
          <AdminButton variant="outline" size="sm" onClick={print}><Printer className="h-3.5 w-3.5 mr-1" /> Print</AdminButton>
          {/* Editable in every state — a manual invoice is an internal document
              the business controls, so a mistake stays correctable even after
              it has been paid. Editing a paid, accountable invoice reconciles
              stock against the new lines. */}
          {canEdit && inv.status !== "void" && (
            <AdminButton variant="outline" size="sm" onClick={() => router.push(`/admin/invoices/new?edit=${inv.id}`)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </AdminButton>
          )}
          {canEdit && inv.status === "draft" && (
            <AdminButton size="sm" onClick={() => changeStatus("published")} disabled={busy}>
              <Send className="h-3.5 w-3.5 mr-1" /> Publish
            </AdminButton>
          )}
          {canEdit && inv.status === "published" && (
            <>
              <AdminButton size="sm" onClick={() => setPayOpen(true)} disabled={busy}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark as paid
              </AdminButton>
              <AdminButton variant="outline" size="sm" onClick={() => setVoidOpen(true)} disabled={busy}>
                <Ban className="h-3.5 w-3.5 mr-1" /> Void
              </AdminButton>
            </>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

      {inv.status === "draft" && (
        <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-xs text-warning">
          This is a draft. It can still be edited, and nothing has been recorded financially. Publish it to issue it to the customer.
        </div>
      )}
      {inv.status === "void" && (
        <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
          Voided{inv.voided_at ? ` on ${formatDateShort(inv.voided_at)}` : ""}
          {inv.void_reason ? ` — ${inv.void_reason}` : ""}. Excluded from all figures.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-charcoal mb-3">Items</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      {["Product", "Qty", "Unit", "Discount", "Total"].map((h) => (
                        <th key={h} className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal-lighter">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inv.items.map((it) => (
                      <tr key={it.id} className="border-b border-border/40">
                        <td className="py-2.5">
                          <p className="text-charcoal">{it.product_name}</p>
                          {it.variant_name && <p className="text-[11px] text-charcoal-lighter">{it.variant_name}</p>}
                        </td>
                        <td className="py-2.5 text-charcoal [font-variant-numeric:tabular-nums]">{it.quantity}</td>
                        <td className="py-2.5 text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(Number(it.unit_price))}</td>
                        <td className="py-2.5 text-success [font-variant-numeric:tabular-nums]">
                          {Number(it.line_discount) > 0 ? `− ${formatCurrency(Number(it.line_discount))}` : "—"}
                        </td>
                        <td className="py-2.5 font-medium text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(Number(it.line_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-4">
                <div className="w-full sm:w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between text-charcoal-lighter"><span>Subtotal</span><span className="text-charcoal">{formatCurrency(Number(inv.subtotal))}</span></div>
                  {Number(inv.line_discount_total) > 0 && <div className="flex justify-between text-success"><span>Line discounts</span><span>− {formatCurrency(Number(inv.line_discount_total))}</span></div>}
                  {Number(inv.order_discount) > 0 && <div className="flex justify-between text-success"><span>Order discount</span><span>− {formatCurrency(Number(inv.order_discount))}</span></div>}
                  {Number(inv.delivery_charge) > 0 && <div className="flex justify-between text-charcoal-lighter"><span>Delivery</span><span className="text-charcoal">{formatCurrency(Number(inv.delivery_charge))}</span></div>}
                  <div className="flex justify-between pt-2 border-t border-border font-heading text-base font-bold text-charcoal">
                    <span>Total</span><span>{formatCurrency(Number(inv.total))}</span>
                  </div>
                </div>
              </div>

              {inv.notes && <p className="mt-4 text-xs text-charcoal-lighter"><span className="font-medium text-charcoal">Notes: </span>{inv.notes}</p>}
            </CardContent>
          </Card>

          {(inv.seal_url || inv.signature_url) && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-charcoal mb-3">Seal &amp; signature</p>
                <div className="flex gap-6">
                  {inv.seal_url && <div className="relative h-20 w-32"><Image src={inv.seal_url} alt="Seal" fill className="object-contain" unoptimized /></div>}
                  {inv.signature_url && <div className="relative h-20 w-32"><Image src={inv.signature_url} alt="Signature" fill className="object-contain" unoptimized /></div>}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <p className="text-sm font-semibold text-charcoal mb-1">Customer</p>
              <p className="text-charcoal">{inv.customer_name}</p>
              {inv.customer_phone && <p className="text-charcoal-lighter text-xs">{inv.customer_phone}</p>}
              {inv.customer_email && <p className="text-charcoal-lighter text-xs">{inv.customer_email}</p>}
              {inv.customer_address && <p className="text-charcoal-lighter text-xs">{inv.customer_address}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2 text-xs">
              <p className="text-sm font-semibold text-charcoal mb-1">Record</p>
              <div className="flex justify-between"><span className="text-charcoal-lighter">Created</span><span className="text-charcoal">{formatDateShort(inv.created_at)}</span></div>
              {inv.created_by_name && <div className="flex justify-between"><span className="text-charcoal-lighter">By</span><span className="text-charcoal">{inv.created_by_name}</span></div>}
              {inv.published_at && <div className="flex justify-between"><span className="text-charcoal-lighter">Published</span><span className="text-charcoal">{formatDateShort(inv.published_at)}</span></div>}
              {inv.paid_at && <div className="flex justify-between"><span className="text-charcoal-lighter">Paid</span><span className="text-charcoal">{formatDateShort(inv.paid_at)}</span></div>}
              {inv.payment_method && <div className="flex justify-between"><span className="text-charcoal-lighter">Method</span><span className="text-charcoal capitalize">{inv.payment_method}</span></div>}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-charcoal-lighter">Stock applied</span>
                <span className="text-charcoal">{inv.stock_applied ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal-lighter">Counted as revenue</span>
                <span className="text-charcoal">{inv.revenue_applied ? "Yes" : "No"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mark as paid */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark {inv.voucher_no} as paid</DialogTitle>
            <DialogDescription>
              {inv.affects_inventory
                ? "This will deduct stock and count the invoice as revenue. Paid invoices are permanent — they cannot be edited or voided afterwards."
                : "This invoice is excluded from stock and accounting, so nothing else will change. Paid invoices are permanent."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="block text-xs text-charcoal-lighter mb-1">Payment method</label>
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="rocket">Rocket</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setPayOpen(false)}>Cancel</AdminButton>
            <AdminButton onClick={() => changeStatus("paid", { payment_method: payMethod })} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Mark as paid
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insufficient stock — two explicit choices, and closing does nothing.
          Never wire a destructive, irreversible action to a dialog's dismissal. */}
      <Dialog open={stockChoiceOpen} onOpenChange={setStockChoiceOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Not enough stock</DialogTitle>
            <DialogDescription>
              These items don&apos;t have enough stock recorded. The goods may already have left the shelf — choose how
              to record this. Marking paid cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <ul className="rounded-lg bg-pearl border border-border p-3 text-xs text-charcoal space-y-1 max-h-40 overflow-y-auto">
            {shortages.map((s) => <li key={s}>• {s}</li>)}
          </ul>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <AdminButton
              className="w-full"
              onClick={() => { setStockChoiceOpen(false); changeStatus("paid", { payment_method: pendingPayMethod, allow_negative_stock: true }); }}
              disabled={busy}
            >
              Mark paid anyway — stock will go negative
            </AdminButton>
            <AdminButton
              variant="outline"
              className="w-full"
              onClick={() => { setStockChoiceOpen(false); changeStatus("paid", { payment_method: pendingPayMethod, skip_stock: true }); }}
              disabled={busy}
            >
              Mark paid without updating stock
            </AdminButton>
            <AdminButton variant="ghost" className="w-full" onClick={() => setStockChoiceOpen(false)} disabled={busy}>
              Cancel — don&apos;t mark as paid
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Void {inv.voucher_no}?</DialogTitle>
            <DialogDescription>It stays in the register for audit but is excluded from all figures. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Reason (optional)" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setVoidOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={() => changeStatus("void", { void_reason: voidReason })} disabled={busy}>Void</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
