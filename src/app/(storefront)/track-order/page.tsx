"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Search, Package, Truck, CheckCircle2, Clock, MapPin, PackageCheck, CreditCard, Loader2, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatCurrency } from "@/lib/utils";

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

const customerStatusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  confirmed: CheckCircle2,
  processing: Package,
  shipped: Truck,
  on_delivery: MapPin,
  received: PackageCheck,
  not_received: Package,
};

// The full expected timeline steps for customer view
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
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  created_at: string;
  items: { product_name: string; quantity: number; unit_price: number; total_price: number }[];
  shipping_address?: { name: string; phone: string; address_line_1: string; district: string; division: string };
  timeline: { status: string; note: string; created_at: string }[];
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={null}>
      <TrackOrderContent />
    </Suspense>
  );
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const trackOrder = useCallback(async (q: string, phoneQ: string) => {
    if (!q.trim() || !phoneQ.trim()) return;
    setLoading(true);
    setNotFound(false);
    setOrder(null);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(q.trim())}?phone=${encodeURIComponent(phoneQ.trim())}`);
      if (!res.ok) { setNotFound(true); return; }
      const data = await res.json();
      if (!data || !data.order_number) { setNotFound(true); return; }
      setOrder(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Deep-link support: /track-order?order=ORD-123456 auto-fills the order
  // number, but the phone number still has to be typed in — it's never safe
  // to put in a shareable URL, since that's the whole point of requiring it.
  useEffect(() => {
    const q = searchParams.get("order");
    if (q) setOrderId(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    trackOrder(orderId, phone);
  };

  // Build timeline from real data — map each step to completed/pending
  const buildTimeline = () => {
    if (!order) return [];
    const timelineMap = new Map<string, string>();
    for (const entry of order.timeline || []) {
      timelineMap.set(entry.status, entry.created_at);
    }

    return timelineSteps.map((step) => ({
      ...step,
      done: timelineMap.has(step.key),
      date: timelineMap.get(step.key) || "",
    }));
  };

  // Customer-facing status label
  const getCustomerStatus = (status: string) => customerStatusLabels[status] || status;

  const getStatusBadgeVariant = (status: string): "warning" | "secondary" | "success" | "destructive" | "default" => {
    if (status === "received") return "success";
    if (status === "not_received") return "destructive";
    if (status === "pending") return "warning";
    return "secondary";
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-hero-gradient py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "Track Order" }]} />
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mt-4">
            Track Your Order
          </h1>
          <p className="text-charcoal-lighter mt-2">
            Enter your order number to check the delivery status.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Search — both the order number AND the phone it was placed under
            are required, so an order can't be looked up by anyone who only
            knows/guesses the order number. */}
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3 mb-10">
          <Input
            placeholder="Order number (e.g., ORD-0527)"
            value={orderId}
            onChange={(e) => { setOrderId(e.target.value); setNotFound(false); }}
            icon={<Search className="h-4 w-4" />}
            className="flex-1"
          />
          <Input
            placeholder="Phone number used for the order"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setNotFound(false); }}
            type="tel"
            className="flex-1"
          />
          <Button variant="secondary" type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Track"}
          </Button>
        </form>

        {/* Not Found */}
        {notFound && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <EmptyState icon={ShoppingBag} title="Order not found" description="Please check the order number and try again." />
          </motion.div>
        )}

        {/* Result */}
        {order && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Order Summary */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
            >
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-charcoal">{order.order_number}</h3>
                    <p className="text-xs text-charcoal-lighter">Placed on {formatDateTime(order.created_at)}</p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {getCustomerStatus(order.status)}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between gap-2 text-sm">
                      <span className="text-charcoal-light flex-1 min-w-0 truncate">
                        {item.product_name} {item.quantity > 1 ? `x${item.quantity}` : ""}
                      </span>
                      <span className="font-medium text-charcoal">{formatCurrency(Number(item.total_price))}</span>
                    </div>
                  ))}
                  {Number(order.shipping_cost) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-charcoal-light">Shipping</span>
                      <span className="font-medium text-charcoal">{formatCurrency(Number(order.shipping_cost))}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-charcoal">Total</span>
                    <span className="text-charcoal">{formatCurrency(Number(order.total))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            </motion.div>

            {/* Timeline */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
            >
            <Card>
              <CardContent className="p-5">
                <h3 className="font-heading text-base font-semibold text-charcoal mb-5">Delivery Progress</h3>
                <div className="space-y-0">
                  {buildTimeline().map((step, i, arr) => {
                    const isLast = i === arr.length - 1;
                    const Icon = step.icon;

                    return (
                      <motion.div
                        key={step.key}
                        className="flex gap-4"
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut", delay: 0.15 + i * 0.06 }}
                      >
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border-2 flex-shrink-0 transition-colors duration-300",
                            step.done
                              ? "bg-secondary border-secondary text-white"
                              : "bg-white border-border text-charcoal-lighter"
                          )}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          {!isLast && (
                            <div className={cn("w-0.5 h-8 transition-colors duration-300", step.done ? "bg-secondary" : "bg-border")} />
                          )}
                        </div>
                        <div className="pb-6">
                          <p className={cn("text-sm font-medium", step.done ? "text-charcoal" : "text-charcoal-lighter")}>
                            {step.label}
                          </p>
                          {step.date && (
                            <p className="text-xs text-charcoal-lighter">{formatDateTime(step.date)}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Not Received notice */}
                {order.status === "not_received" && (
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="mt-4 p-4 rounded-2xl bg-destructive/5 border border-destructive/10"
                  >
                    <p className="text-sm font-medium text-destructive">Delivery could not be completed</p>
                    <p className="text-xs text-destructive/70 mt-0.5">Please contact support for assistance.</p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
            </motion.div>

            {/* Shipping Address */}
            {order.shipping_address && (
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.15 }}
              >
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-heading text-base font-semibold text-charcoal mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-secondary" /> Shipping Address
                  </h3>
                  <p className="text-sm text-charcoal">{order.shipping_address.name}</p>
                  <p className="text-sm text-charcoal-lighter">{order.shipping_address.phone}</p>
                  <p className="text-sm text-charcoal-lighter">{order.shipping_address.address_line_1}</p>
                  {(order.shipping_address.district || order.shipping_address.division) && (
                    <p className="text-sm text-charcoal-lighter">
                      {order.shipping_address.district}{order.shipping_address.district && order.shipping_address.division ? ", " : ""}{order.shipping_address.division}
                    </p>
                  )}
                </CardContent>
              </Card>
              </motion.div>
            )}

            {/* Payment Info */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
            >
            <Card>
              <CardContent className="p-5">
                <h3 className="font-heading text-base font-semibold text-charcoal mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-secondary" /> Payment
                </h3>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-charcoal-lighter">Method</span>
                  <span className="font-medium text-charcoal capitalize">{order.payment_method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-charcoal-lighter">Status</span>
                  <Badge variant={order.payment_status === "paid" ? "success" : "warning"} className="text-[10px]">
                    {order.payment_status === "paid" ? "Paid" : "Pending"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
