"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Package, Truck, CheckCircle2, Clock, MapPin, CreditCard,
  Copy, Phone, Mail, User, Printer, Download, XCircle, ArrowUpRight, MessageSquare, ShoppingCart, Edit, Save, Loader2, RotateCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock, confirmed: CheckCircle2, processing: Package,
  shipped: Truck, on_delivery: MapPin, received: CheckCircle2, not_received: XCircle, returned: RotateCcw, cancelled: XCircle,
};

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : "";
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const adminRole = getCookie("chinexa-role");
  const canEditOrder = adminRole === "superadmin";

  const [order, setOrder] = useState<Record<string, unknown> | null>(null);

  // Edit order dialog
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [returns, setReturns] = useState<Record<string, unknown>[]>([]);
  const [returnActionLoading, setReturnActionLoading] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
    fetch(`/api/returns?order_id=${id}`).then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setReturns(data);
    }).catch(() => {});
  }, [id]);

  const handleSaveNote = async () => {
    await fetch(`/api/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: note }) });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const handleStatusUpdate = async (status: string) => {
    await fetch(`/api/orders/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setOrder((prev) => prev ? { ...prev, status } : prev);
  };

  const handleReturnAction = async (returnId: string, action: "approved" | "rejected" | "refunded") => {
    setReturnActionLoading(returnId);
    try {
      await fetch(`/api/returns/${returnId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: action }) });
      setReturns((prev) => prev.map((r) => r.id === returnId ? { ...r, status: action } : r));
      if (action === "approved") setOrder((prev) => prev ? { ...prev, status: "returned" } : prev);
      if (action === "refunded") setOrder((prev) => prev ? { ...prev, payment_status: "refunded" } : prev);
    } catch {} finally { setReturnActionLoading(""); }
  };

  const openEditOrder = () => {
    if (!order) return;
    setEditStatus(String(order.status || "pending"));
    setEditPaymentStatus(String(order.payment_status || "pending"));
    setEditNotes(String(order.notes || ""));
    setEditOrderOpen(true);
  };

  const handleSaveOrder = async () => {
    setEditSaving(true);
    try {
      await fetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus, payment_status: editPaymentStatus, notes: editNotes }),
      });
      setOrder((prev) => prev ? { ...prev, status: editStatus, payment_status: editPaymentStatus, notes: editNotes } : prev);
      setEditOrderOpen(false);
    } catch {} finally { setEditSaving(false); }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5"><Skeleton className="h-64 w-full" /><Skeleton className="h-48 w-full" /></div>
          <div className="space-y-5"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-5">
        <Link href="/admin/orders" className="flex items-center gap-2 text-sm text-charcoal-lighter hover:text-charcoal"><ArrowLeft className="h-4 w-4" /> Back to Orders</Link>
        <EmptyState icon={ShoppingCart} title="Order not found" description="This order doesn't exist or has been deleted." actionLabel="Back to Orders" actionHref="/admin/orders" />
      </div>
    );
  }

  const items = (order.items as Record<string, unknown>[]) || [];
  const billing = (order.billing_address as Record<string, unknown>) || {};
  const shipping = (order.shipping_address as Record<string, unknown>) || billing;
  const timeline = (order.timeline as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold text-charcoal">{(order.order_number as string) || id}</h1>
              <Badge variant="secondary" className="text-[10px] capitalize">{String(order.status)}</Badge>
              <Badge variant={(order.payment_status as string) === "paid" ? "success" : "warning"} className="text-[10px]">{String(order.payment_status)}</Badge>
            </div>
            <p className="text-xs text-charcoal-lighter">{formatDateShort(order.created_at as string)}</p>
          </div>
        </div>
        {canEditOrder && (
          <button onClick={openEditOrder} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-[11px] font-medium text-charcoal-lighter hover:border-secondary hover:text-secondary transition-all">
            <Edit className="h-3 w-3" /> Edit Order
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Order Items ({items.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-charcoal-lighter text-center py-4">No items</p>
              ) : items.map((item, i) => (
                <div key={i} className="flex gap-4 p-3 rounded-xl bg-pearl/40">
                  <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-pearl shrink-0">
                    <Image src={(item.product_image as string) || "https://placehold.co/56x56"} alt={(item.product_name as string) || ""} fill className="object-cover" sizes="56px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">{String(item.product_name)}</p>
                    {item.variant ? <p className="text-[10px] text-charcoal-lighter">{String(item.variant)}</p> : null}
                    <p className="text-xs text-charcoal-lighter">Qty: {item.quantity as number}</p>
                  </div>
                  <p className="text-sm font-semibold text-charcoal shrink-0">{formatCurrency(Number(item.total_price) || Number(item.unit_price))}</p>
                </div>
              ))}
              <Separator />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-charcoal-lighter">Subtotal</span><span>{formatCurrency(Number(order.subtotal))}</span></div>
                <div className="flex justify-between"><span className="text-charcoal-lighter">Shipping</span><span>{Number(order.shipping_cost) === 0 ? "Free" : formatCurrency(Number(order.shipping_cost))}</span></div>
                {Number(order.discount) > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>-{formatCurrency(Number(order.discount))}</span></div>}
                <Separator />
                <div className="flex justify-between font-semibold text-charcoal text-base"><span>Total</span><span>{formatCurrency(Number(order.total))}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {timeline.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Order Timeline</CardTitle></CardHeader>
              <CardContent>
                {timeline.map((step, i) => {
                  const isLast = i === timeline.length - 1;
                  const Icon = statusIcons[(step.status as string)] || Clock;
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-secondary bg-secondary text-white shrink-0">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        {!isLast && <div className="w-0.5 h-6 bg-secondary" />}
                      </div>
                      <div className="pb-4 pt-1">
                        <p className="text-sm font-medium text-charcoal capitalize">{String(step.status)}</p>
                        <p className="text-[10px] text-charcoal-lighter">{String(step.note || "")}</p>
                        <p className="text-[10px] text-charcoal-lighter">
                          {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(step.created_at as string))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-secondary" /> Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[70px]" />
              <div className="flex justify-end mt-2">
                <AdminButton size="sm" onClick={handleSaveNote} disabled={!note.trim()} className={noteSaved ? "!bg-success" : ""}>{noteSaved ? "Saved!" : "Save"}</AdminButton>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-secondary" /> Customer</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium text-charcoal">{String(order.customer_name || "")}</p>
              <div className="flex items-center gap-2 text-charcoal-lighter"><Phone className="h-3 w-3" /> {String(order.customer_phone || "")}</div>
            </CardContent>
          </Card>

          {/* Shipping */}
          {shipping.name ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-secondary" /> Shipping</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-0.5">
                <p className="font-medium text-charcoal">{String(shipping.name)}</p>
                {shipping.phone ? <p className="text-charcoal-lighter">{String(shipping.phone)}</p> : null}
                {shipping.address_line_1 ? <p className="text-charcoal-lighter">{String(shipping.address_line_1)}</p> : null}
                {(shipping.district || shipping.division) ? <p className="text-charcoal-lighter">{String(shipping.district || "")}, {String(shipping.division || "")}</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-secondary" /> Payment</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-charcoal-lighter">Method</span><span className="font-medium text-charcoal">{String(order.payment_method)}</span></div>
              {order.transaction_id ? (
                <div className="flex justify-between items-center">
                  <span className="text-charcoal-lighter">TXN ID</span>
                  <div className="flex items-center gap-1"><code className="text-xs font-mono text-charcoal">{String(order.transaction_id)}</code><button className="text-charcoal-lighter hover:text-secondary"><Copy className="h-3 w-3" /></button></div>
                </div>
              ) : null}
              <div className="flex justify-between"><span className="text-charcoal-lighter">Status</span><Badge variant={String(order.payment_status) === "paid" ? "success" : "warning"} className="text-[9px]">{String(order.payment_status)}</Badge></div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <AdminButton variant="outline" className="w-full" size="sm" onClick={() => window.open(`/invoice?id=${encodeURIComponent(id)}`, "_blank")}><Printer className="h-3.5 w-3.5" /> Print Invoice</AdminButton>
              <AdminButton variant="outline" className="w-full" size="sm" onClick={() => window.open(`/invoice?id=${encodeURIComponent(id)}`, "_blank")}><Download className="h-3.5 w-3.5" /> Download Receipt</AdminButton>
              {!["received", "not_received"].includes(order.status as string) && (
                <><Separator /><AdminButton variant="danger" className="w-full" size="sm" onClick={() => handleStatusUpdate("not_received")}><XCircle className="h-3.5 w-3.5" /> Mark Not Received</AdminButton></>
              )}
            </CardContent>
          </Card>

          {/* Returns */}
          {returns.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5 text-secondary" /> Returns</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {returns.map((ret) => (
                  <div key={ret.id as string} className="p-3 rounded-xl border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={String(ret.status) === "approved" ? "success" : String(ret.status) === "rejected" ? "destructive" : String(ret.status) === "refunded" ? "success" : "warning"} className="text-[9px] capitalize">{String(ret.status)}</Badge>
                      <span className="text-[10px] text-charcoal-lighter">{formatDateShort(ret.created_at as string)}</span>
                    </div>
                    <p className="text-xs text-charcoal"><span className="font-medium">Reason:</span> {String(ret.reason).replace("_", " ")}</p>
                    {ret.description ? <p className="text-xs text-charcoal-lighter">{String(ret.description)}</p> : null}
                    <p className="text-xs text-charcoal"><span className="font-medium">Refund:</span> {formatCurrency(Number(ret.refund_amount))}</p>
                    {ret.status === "requested" && canEditOrder && (
                      <div className="flex gap-2 pt-1">
                        <AdminButton size="xs" onClick={() => handleReturnAction(ret.id as string, "approved")} disabled={returnActionLoading === ret.id}>
                          {returnActionLoading === ret.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve
                        </AdminButton>
                        <AdminButton variant="danger" size="xs" onClick={() => handleReturnAction(ret.id as string, "rejected")} disabled={returnActionLoading === ret.id}>
                          <XCircle className="h-3 w-3" /> Reject
                        </AdminButton>
                      </div>
                    )}
                    {ret.status === "approved" && canEditOrder && (
                      <AdminButton size="xs" variant="outline" onClick={() => handleReturnAction(ret.id as string, "refunded")} disabled={returnActionLoading === ret.id}>
                        {returnActionLoading === ret.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CreditCard className="h-3 w-3" />} Mark Refunded
                      </AdminButton>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Order Dialog */}
      <Dialog open={editOrderOpen} onOpenChange={setEditOrderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-secondary" /> Edit Order</DialogTitle>
            <DialogDescription>{(order.order_number as string) || id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Order Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending", "confirmed", "processing", "shipped", "on_delivery", "received", "not_received"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Payment Status</label>
              <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["pending", "paid", "failed", "refunded"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea label="Order Notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Internal notes..." className="min-h-[60px]" />
          </div>
          <DialogFooter>
            <button onClick={() => setEditOrderOpen(false)} className="px-4 py-2 text-xs text-charcoal-lighter hover:text-charcoal">Cancel</button>
            <button onClick={handleSaveOrder} disabled={editSaving} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary text-white text-xs font-semibold hover:bg-secondary-dark hover:shadow-[0_6px_25px_rgba(192,57,43,0.3)] hover:-translate-y-[1px] active:scale-[0.96] disabled:opacity-40 transition-all duration-300">
              {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
