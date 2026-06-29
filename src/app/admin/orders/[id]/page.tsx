"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, Package, Truck, CheckCircle2, Clock, MapPin, CreditCard,
  Copy, Phone, Mail, User, Printer, Download, XCircle, ArrowUpRight, MessageSquare, ShoppingCart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock, confirmed: CheckCircle2, processing: Package,
  shipped: Truck, on_delivery: MapPin, received: CheckCircle2, not_received: XCircle,
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
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
        <div className="flex gap-2">
          <AdminButton variant="outline" size="sm" onClick={() => window.open(`/invoice?id=${encodeURIComponent(id)}`, "_blank")}><Printer className="h-3.5 w-3.5" /> Invoice</AdminButton>
          {order.status !== "received" && order.status !== "not_received" && (
            <AdminButton size="sm" onClick={() => {
              const nextMap: Record<string, string> = { pending: "confirmed", confirmed: "processing", processing: "shipped", shipped: "on_delivery", on_delivery: "received" };
              const next = nextMap[order.status as string];
              if (next) handleStatusUpdate(next);
            }}>
              <ArrowUpRight className="h-3.5 w-3.5" /> Advance Status
            </AdminButton>
          )}
        </div>
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
                        <p className="text-[10px] text-charcoal-lighter">{formatDateShort(step.created_at as string)}</p>
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
        </div>
      </div>
    </div>
  );
}
