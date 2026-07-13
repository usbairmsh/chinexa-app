"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, MapPin, CreditCard, Copy, PackageCheck, Loader2, ShoppingBag, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

// Admin status → Customer-friendly label
const customerStatusLabels: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  on_delivery: "Out for Delivery",
  received: "Delivered",
  not_received: "Delivery Failed",
  returned: "Returned",
  cancelled: "Cancelled",
};

// Full timeline steps for customer display
const timelineSteps = [
  { key: "pending", label: "Order Placed", icon: Clock },
  { key: "confirmed", label: "Order Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "on_delivery", label: "Out for Delivery", icon: MapPin },
  { key: "received", label: "Delivered", icon: PackageCheck },
];

function formatDateTime(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    + " — "
    + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

interface OrderData {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  transaction_id?: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  created_at: string;
  items: { product_name: string; product_image: string; variant: string; quantity: number; unit_price: number; total_price: number }[];
  shipping_address?: { name: string; phone: string; address_line_1: string; city: string; district: string; division: string };
  timeline: { status: string; note: string; created_at: string }[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDesc, setReturnDesc] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSubmitted, setReturnSubmitted] = useState(false);
  const [existingReturn, setExistingReturn] = useState<{ id: string; status: string; created_at: string } | null>(null);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    fetch(`/api/orders/${encodeURIComponent(id)}?customer_id=${encodeURIComponent(user.id)}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
    // Check for existing return
    fetch(`/api/returns?order_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const active = data.find((r: Record<string, unknown>) => r.status !== "rejected");
          if (active) setExistingReturn({ id: active.id as string, status: active.status as string, created_at: active.created_at as string });
        }
      })
      .catch(() => {});
  }, [id, user?.id]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleReturn = async () => {
    if (!returnReason || !order) return;
    setReturnSubmitting(true);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, reason: returnReason, description: returnDesc.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setReturnSubmitted(true);
      setReturnOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to submit return request");
    } finally { setReturnSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 text-secondary animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-5">
        <Link href="/dashboard/orders" className="flex items-center gap-2 text-sm text-charcoal-lighter hover:text-charcoal">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
        <EmptyState icon={ShoppingBag} title="Order not found" description="This order doesn't exist." actionLabel="My Orders" actionHref="/dashboard/orders" />
      </div>
    );
  }

  // Build timeline from real data
  const timelineMap = new Map<string, string>();
  for (const entry of order.timeline || []) {
    timelineMap.set(entry.status, entry.created_at);
  }
  const builtTimeline = timelineSteps.map((step) => ({
    ...step,
    done: timelineMap.has(step.key),
    date: timelineMap.get(step.key) || "",
  }));

  const customerStatus = customerStatusLabels[order.status] || order.status;
  const statusVariant: "warning" | "secondary" | "success" | "destructive" =
    order.status === "received" ? "success"
    : order.status === "not_received" ? "destructive"
    : order.status === "pending" ? "warning"
    : "secondary";

  return (
    <div className="space-y-5">
      <div className="flex items-start sm:items-center gap-3 flex-wrap">
        <Link href="/dashboard/orders" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg sm:text-xl font-semibold text-charcoal">{order.order_number}</h2>
          <p className="text-[11px] sm:text-xs text-charcoal-lighter">Placed on {formatDateTime(order.created_at)}</p>
        </div>
        <Badge variant={statusVariant} className="shrink-0">{customerStatus}</Badge>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Main — Items + Timeline */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-5">
          {/* Items */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Order Items</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex gap-3 sm:gap-4">
                  <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-pearl shrink-0">
                    <Image src={item.product_image || "https://placehold.co/80x80"} alt={item.product_name} fill className="object-cover" sizes="80px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-charcoal line-clamp-2">{item.product_name}</p>
                    {item.variant && <p className="text-[11px] sm:text-xs text-charcoal-lighter mt-0.5">{item.variant}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] sm:text-xs text-charcoal-lighter">Qty: {item.quantity}</p>
                      <p className="text-xs sm:text-sm font-semibold text-charcoal">{formatCurrency(Number(item.total_price))}</p>
                    </div>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-charcoal-lighter">Subtotal</span><span>{formatCurrency(Number(order.subtotal))}</span></div>
                <div className="flex justify-between"><span className="text-charcoal-lighter">Shipping</span><span>{Number(order.shipping_cost) === 0 ? "Free" : formatCurrency(Number(order.shipping_cost))}</span></div>
                {Number(order.discount) > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>-{formatCurrency(Number(order.discount))}</span></div>}
                <Separator />
                <div className="flex justify-between font-semibold text-charcoal"><span>Total</span><span>{formatCurrency(Number(order.total))}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Order Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-0">
                {builtTimeline.map((step, i) => {
                  const isLast = i === builtTimeline.length - 1;
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0",
                          step.done ? "bg-secondary border-secondary text-white" : "bg-white border-border text-charcoal-lighter"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {!isLast && <div className={cn("w-0.5 h-8", step.done ? "bg-secondary" : "bg-border")} />}
                      </div>
                      <div className="pb-6 pt-1.5">
                        <p className={cn("text-sm font-medium", step.done ? "text-charcoal" : "text-charcoal-lighter")}>{step.label}</p>
                        {step.date && <p className="text-xs text-charcoal-lighter">{formatDateTime(step.date)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Not Received notice */}
              {order.status === "not_received" && (
                <div className="mt-4 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                  <p className="text-sm font-medium text-destructive">Delivery could not be completed</p>
                  <p className="text-xs text-destructive/70 mt-0.5">Please contact support for assistance.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar — Address + Payment */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-5">
          {/* Shipping Address */}
          {order.shipping_address && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-secondary" /> Shipping Address</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-0.5">
                <p className="font-medium text-charcoal">{order.shipping_address.name}</p>
                <p className="text-charcoal-lighter">{order.shipping_address.phone}</p>
                <p className="text-charcoal-lighter">{order.shipping_address.address_line_1}</p>
                {(order.shipping_address.district || order.shipping_address.division) && (
                  <p className="text-charcoal-lighter">{order.shipping_address.district}{order.shipping_address.district && order.shipping_address.division ? ", " : ""}{order.shipping_address.division}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-secondary" /> Payment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-charcoal-lighter">Method</span>
                <span className="font-medium text-charcoal capitalize">{order.payment_method}</span>
              </div>
              {order.transaction_id && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-charcoal-lighter shrink-0">Transaction ID</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <code className="text-xs font-mono text-charcoal truncate">{order.transaction_id}</code>
                    <button onClick={() => handleCopy(order.transaction_id!)} className="text-charcoal-lighter hover:text-secondary shrink-0 p-2">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {copied && <span className="text-[9px] text-success">Copied</span>}
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-charcoal-lighter">Status</span>
                <Badge variant={order.payment_status === "paid" ? "success" : "warning"} className="text-[10px]">
                  {order.payment_status === "paid" ? "Paid" : "Pending"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Button variant="outline" className="w-full text-sm" onClick={() => window.open(`/invoice?id=${encodeURIComponent(order.order_number)}`, "_blank")}>Download Invoice</Button>

              {/* Return Section — smart eligibility */}
              {(() => {
                const status = order.status;
                const deliveredEntry = order.timeline.find((t) => t.status === "received");
                const daysSinceDelivery = deliveredEntry ? (Date.now() - new Date(deliveredEntry.created_at).getTime()) / (1000 * 60 * 60 * 24) : 999;
                const returnWindowDays = 7;
                const returnDeadline = deliveredEntry ? new Date(new Date(deliveredEntry.created_at).getTime() + returnWindowDays * 24 * 60 * 60 * 1000) : null;

                // Already submitted return
                if (returnSubmitted || existingReturn) {
                  const retStatus = existingReturn?.status || "requested";
                  return (
                    <div className={cn("p-3 rounded-xl border text-center", retStatus === "approved" ? "bg-success/10 border-success/20" : retStatus === "rejected" ? "bg-destructive/10 border-destructive/20" : retStatus === "refunded" ? "bg-success/10 border-success/20" : "bg-amber-50 border-amber-200")}>
                      <RotateCcw className={cn("h-5 w-5 mx-auto mb-1", retStatus === "approved" || retStatus === "refunded" ? "text-success" : retStatus === "rejected" ? "text-destructive" : "text-amber-600")} />
                      <p className={cn("text-xs font-medium", retStatus === "approved" || retStatus === "refunded" ? "text-success" : retStatus === "rejected" ? "text-destructive" : "text-amber-700")}>
                        {retStatus === "requested" && "Return Request Pending"}
                        {retStatus === "approved" && "Return Approved — Awaiting Refund"}
                        {retStatus === "refunded" && "Return Completed & Refunded"}
                        {retStatus === "rejected" && "Return Request Rejected"}
                      </p>
                      <p className="text-[10px] text-charcoal-lighter mt-0.5">
                        {retStatus === "requested" && "We're reviewing your return request. You'll be notified soon."}
                        {retStatus === "approved" && "Your refund is being processed."}
                        {retStatus === "refunded" && "Your refund has been issued."}
                        {retStatus === "rejected" && "Please contact support if you have questions."}
                      </p>
                    </div>
                  );
                }

                // Order delivered and within return window
                if (status === "received" && daysSinceDelivery <= returnWindowDays) {
                  return (
                    <>
                      <Button variant="outline" className="w-full text-sm text-secondary border-secondary/30" onClick={() => setReturnOpen(true)}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Request Return
                      </Button>
                      <p className="text-[10px] text-charcoal-lighter text-center">
                        Return window closes {returnDeadline ? returnDeadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "soon"}
                      </p>
                    </>
                  );
                }

                // Order delivered but return window expired
                if (status === "received" && daysSinceDelivery > returnWindowDays) {
                  return (
                    <div className="p-3 rounded-xl bg-pearl/60 border border-border/20 text-center">
                      <p className="text-xs font-medium text-charcoal-lighter">Return Window Expired</p>
                      <p className="text-[10px] text-charcoal-lighter mt-0.5">Returns must be requested within {returnWindowDays} days of delivery. The window closed on {returnDeadline?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>
                    </div>
                  );
                }

                // Order returned/cancelled
                if (status === "returned") {
                  return (
                    <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-center">
                      <p className="text-xs font-medium text-success">Order Returned</p>
                      <p className="text-[10px] text-success/70 mt-0.5">This order has been returned and processed.</p>
                    </div>
                  );
                }
                if (status === "cancelled") {
                  return (
                    <div className="p-3 rounded-xl bg-pearl/60 border border-border/20 text-center">
                      <p className="text-xs font-medium text-charcoal-lighter">Order Cancelled</p>
                    </div>
                  );
                }

                // Order not yet delivered — show context message
                if (status === "not_received") {
                  return (
                    <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/10 text-center">
                      <p className="text-xs font-medium text-destructive">Delivery Issue Reported</p>
                      <p className="text-[10px] text-charcoal-lighter mt-0.5">Our team is looking into this. Please contact support for updates.</p>
                    </div>
                  );
                }

                // Still in transit
                const transitMessages: Record<string, string> = {
                  pending: "Your order hasn't been confirmed yet.",
                  confirmed: "Your order is being prepared for shipping.",
                  processing: "Your order is being packed.",
                  shipped: "Your order is on the way! You can request a return after delivery.",
                  on_delivery: "Your order is out for delivery. You can request a return after receiving it.",
                };
                const msg = transitMessages[status];
                if (msg) {
                  return (
                    <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-center">
                      <p className="text-xs font-medium text-blue-600">Returns Not Available Yet</p>
                      <p className="text-[10px] text-charcoal-lighter mt-0.5">{msg}</p>
                    </div>
                  );
                }

                return null;
              })()}

              <Link href="/contact">
                <Button variant="ghost" className="w-full text-sm text-charcoal-lighter">Need Help?</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Return Request Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-secondary" /> Request Return</DialogTitle>
            <DialogDescription>Submit a return request for order {order?.order_number}. Returns must be within 7 days of delivery.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Reason<span className="text-destructive"> *</span></label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="damaged">Product damaged during delivery</SelectItem>
                  <SelectItem value="wrong_item">Received wrong item</SelectItem>
                  <SelectItem value="not_as_described">Product not as described</SelectItem>
                  <SelectItem value="defective">Product is defective</SelectItem>
                  <SelectItem value="changed_mind">Changed my mind</SelectItem>
                  <SelectItem value="other">Other reason</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea label="Description (optional)" value={returnDesc} onChange={(e) => setReturnDesc(e.target.value)} placeholder="Please describe the issue..." className="min-h-[80px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button variant="secondary" className="!text-white" onClick={handleReturn} disabled={returnSubmitting || !returnReason}>
              {returnSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Submit Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
