"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, MapPin, CreditCard, Copy, PackageCheck, Loader2, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";

// Admin status → Customer-friendly label
const customerStatusLabels: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  on_delivery: "Out for Delivery",
  received: "Delivered",
  not_received: "Delivery Failed",
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
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${encodeURIComponent(id)}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      <div className="flex items-center gap-3">
        <Link href="/dashboard/orders" className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="font-heading text-xl font-semibold text-charcoal">{order.order_number}</h2>
          <p className="text-xs text-charcoal-lighter">Placed on {formatDateTime(order.created_at)}</p>
        </div>
        <Badge variant={statusVariant} className="ml-auto">{customerStatus}</Badge>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Main — Items + Timeline */}
        <div className="lg:col-span-3 space-y-5">
          {/* Items */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Order Items</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden bg-pearl shrink-0">
                    <Image src={item.product_image || "https://placehold.co/80x80"} alt={item.product_name} fill className="object-cover" sizes="80px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">{item.product_name}</p>
                    {item.variant && <p className="text-xs text-charcoal-lighter mt-0.5">{item.variant}</p>}
                    <p className="text-xs text-charcoal-lighter">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-charcoal shrink-0">{formatCurrency(Number(item.total_price))}</p>
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
        <div className="lg:col-span-2 space-y-5">
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
                <div className="flex justify-between items-center">
                  <span className="text-charcoal-lighter">Transaction ID</span>
                  <div className="flex items-center gap-1">
                    <code className="text-xs font-mono text-charcoal">{order.transaction_id}</code>
                    <button onClick={() => handleCopy(order.transaction_id!)} className="text-charcoal-lighter hover:text-secondary">
                      <Copy className="h-3 w-3" />
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
              <Link href="/contact">
                <Button variant="ghost" className="w-full text-sm text-charcoal-lighter">Need Help?</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
