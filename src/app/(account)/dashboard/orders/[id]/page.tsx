"use client";

import { useState, useEffect } from "react";
import { useReorder } from "@/hooks/use-reorder";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, MapPin, CreditCard, Copy, PackageCheck, Loader2, ShoppingBag, RotateCcw, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ReviewImageUpload } from "@/components/storefront/reviews/review-image-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

// Admin status → Customer-friendly label
const customerStatusLabels: Record<string, string> = {
  preorder: "Pre-order Reserved",
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
  is_preorder?: number | boolean;
  preorder_expected_date?: string | null;
  payment_method: string;
  payment_status: string;
  transaction_id?: string;
  total: number;
  subtotal: number;
  shipping_cost: number;
  discount: number;
  created_at: string;
  items: { product_id: string; variant_id: string | null; product_slug?: string; product_name: string; product_image: string; variant: string; quantity: number; unit_price: number; total_price: number }[];
  shipping_address?: { name: string; phone: string; address_line_1: string; city: string; district: string; division: string };
  timeline: { status: string; note: string; created_at: string }[];
}

interface ReturnRow {
  id: string;
  status: string;
  resolution?: string | null;
  reason: string;
  reason_label?: string | null;
  description?: string | null;
  images?: string[];
  refund_amount?: number | null;
  items?: { product_id?: string; variant_id?: string | null; name?: string; qty?: number; unit_price?: number }[];
  created_at: string;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const shouldReduceMotion = useReducedMotion();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDesc, setReturnDesc] = useState("");
  const [returnImages, setReturnImages] = useState<string[]>([]);
  const [returnSelectedItems, setReturnSelectedItems] = useState<string[]>([]); // keys of chosen lines
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSubmitted, setReturnSubmitted] = useState(false);
  const [returnError, setReturnError] = useState("");
  // ALL returns on this order (per-item / multiple returns over time).
  const [orderReturns, setOrderReturns] = useState<ReturnRow[]>([]);
  const [returnReasons, setReturnReasons] = useState<{ code: string; label: string }[]>([]);
  const [returnWindowDays, setReturnWindowDays] = useState(7);
  const [withdrawing, setWithdrawing] = useState(false);
  const RETURN_DESC_MAX = 500;
  // The most recent non-rejected return, for the primary status card.
  const existingReturn = orderReturns.find((r) => r.status !== "rejected") || null;
  const { reorder, reordering } = useReorder();
  const [reorderNote, setReorderNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    fetch(`/api/orders/${encodeURIComponent(id)}?customer_id=${encodeURIComponent(user.id)}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
    // All returns for this order (per-item + multiple over time).
    fetch(`/api/returns?order_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setOrderReturns(data as ReturnRow[]); })
      .catch(() => {});
    // Configurable reasons + return window.
    fetch("/api/settings?key=return_config")
      .then((r) => r.json())
      .then((d) => {
        const cfg = d?.value;
        if (cfg?.reasons && Array.isArray(cfg.reasons)) {
          setReturnReasons(cfg.reasons.filter((x: { enabled?: boolean }) => x.enabled !== false).map((x: { code: string; label: string }) => ({ code: x.code, label: x.label })));
        }
        if (cfg?.windowDays) setReturnWindowDays(Number(cfg.windowDays) || 7);
      })
      .catch(() => {});
  }, [id, user?.id]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleReturn = async () => {
    if (!order) return;
    setReturnError("");
    if (returnSelectedItems.length === 0) { setReturnError("Select at least one item to return."); return; }
    if (!returnReason) { setReturnError("Please choose a reason."); return; }
    setReturnSubmitting(true);
    try {
      // Snapshot the selected order lines so the return is self-contained.
      const items = order.items
        .filter((it) => returnSelectedItems.includes(itemKey(it)))
        .map((it) => ({ product_id: it.product_id, variant_id: it.variant_id, name: it.product_name, qty: it.quantity, unit_price: it.unit_price }));
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          reason: returnReason,
          description: returnDesc.trim().slice(0, RETURN_DESC_MAX) || null,
          images: returnImages,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit return request");
      setReturnSubmitted(true);
      setReturnOpen(false);
      // Refresh the order's returns so the UI reflects the new request.
      fetch(`/api/returns?order_id=${encodeURIComponent(id)}`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setOrderReturns(d as ReturnRow[]); }).catch(() => {});
    } catch (err: unknown) {
      setReturnError(err instanceof Error ? err.message : "Failed to submit return request");
    } finally { setReturnSubmitting(false); }
  };

  const handleWithdrawReturn = async (returnId: string) => {
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/returns/${returnId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: user?.id }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Couldn't withdraw"); }
      setOrderReturns((prev) => prev.filter((r) => r.id !== returnId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Couldn't withdraw the return");
    } finally { setWithdrawing(false); }
  };

  const handleCancel = async () => {
    if (!order || !user?.id) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't cancel this order");
      setCancelOpen(false);
      // Reflect the new status immediately.
      setOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Couldn't cancel this order");
    } finally { setCancelling(false); }
  };

  // A customer may cancel only while the order is still early in fulfilment.
  const canCancel = !!order && ["preorder", "pending", "confirmed", "processing"].includes(order.status);

  // ── Return item helpers (per-item, whole-line) ──
  // A stable key per order line (product + variant), used for selection and
  // "already returned" detection.
  const itemKey = (it: { product_id?: string; variant_id?: string | null }) => `${it.product_id || ""}::${it.variant_id || ""}`;
  // Lines already covered by a non-rejected return can't be returned again.
  const returnedKeys = new Set(
    orderReturns
      .filter((r) => r.status !== "rejected")
      .flatMap((r) => (r.items || []).map((it) => `${it.product_id || ""}::${it.variant_id || ""}`))
  );
  const returnableItems = (order?.items || []).filter((it) => !returnedKeys.has(itemKey(it)));
  const selectedSubtotal = (order?.items || [])
    .filter((it) => returnSelectedItems.includes(itemKey(it)))
    .reduce((s, it) => s + it.unit_price * it.quantity, 0);
  // Reasons: config-driven, with a safe default if config hasn't loaded.
  const effectiveReasons = returnReasons.length > 0 ? returnReasons : [
    { code: "damaged", label: "Product damaged during delivery" },
    { code: "wrong_item", label: "Received wrong item" },
    { code: "not_as_described", label: "Product not as described" },
    { code: "defective", label: "Product is defective" },
    { code: "changed_mind", label: "Changed my mind" },
    { code: "other", label: "Other reason" },
  ];
  const openReturnDialog = () => {
    setReturnReason(""); setReturnDesc(""); setReturnImages([]);
    setReturnSelectedItems(returnableItems.map(itemKey)); // default: all returnable selected
    setReturnError(""); setReturnOpen(true);
  };
  const toggleReturnItem = (key: string) =>
    setReturnSelectedItems((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

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

  // Once a return is active, the general delivery cycle is hidden and the
  // timeline shows ONLY the return/exchange lifecycle (built from the return's
  // current status). Otherwise the normal delivery cycle is shown.
  const activeReturn = existingReturn; // most-recent non-rejected return
  const isExchange = activeReturn?.resolution === "exchange";
  const RETURN_ORDER = ["requested", "approved", "pickup_scheduled", "received", "refund_in_progress", "refunded"];
  const EXCHANGE_ORDER = ["requested", "approved", "pickup_scheduled", "received", "exchange_in_progress", "exchange_shipped", "exchange_delivered"];
  const RETURN_STEP_META: Record<string, { label: string; icon: typeof Clock }> = {
    requested: { label: "Return Requested", icon: RotateCcw },
    approved: { label: "Return Approved", icon: CheckCircle2 },
    pickup_scheduled: { label: "Pickup Scheduled", icon: Truck },
    received: { label: "Product Received", icon: PackageCheck },
    refund_in_progress: { label: "Refund in Progress", icon: Clock },
    refunded: { label: "Refund Completed", icon: CheckCircle2 },
    exchange_in_progress: { label: "Replacement in Progress", icon: Package },
    exchange_shipped: { label: "Replacement Shipped", icon: Truck },
    exchange_delivered: { label: "Replacement Delivered", icon: PackageCheck },
  };

  let builtTimeline: { key: string; label: string; icon: typeof Clock; done: boolean; date: string }[];
  if (activeReturn) {
    const seq = isExchange ? EXCHANGE_ORDER : RETURN_ORDER;
    const currentIdx = seq.indexOf(activeReturn.status);
    builtTimeline = seq.map((key, idx) => ({
      key,
      label: RETURN_STEP_META[key].label,
      icon: RETURN_STEP_META[key].icon,
      done: currentIdx >= 0 && idx <= currentIdx,
      date: "",
    }));
  } else {
    builtTimeline = timelineSteps.map((step) => ({
      ...step,
      done: timelineMap.has(step.key),
      date: timelineMap.get(step.key) || "",
    }));
  }

  const customerStatus = customerStatusLabels[order.status] || order.status;
  const statusVariant: "warning" | "secondary" | "success" | "destructive" =
    order.status === "received" ? "success"
    : order.status === "not_received" ? "destructive"
    : order.status === "pending" ? "warning"
    : "secondary";

  return (
    <div className="space-y-6">
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex items-start sm:items-center gap-3 flex-wrap"
      >
        <Link href="/dashboard/orders" className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-charcoal">{order.order_number}</h1>
          <p className="text-[11px] sm:text-xs text-charcoal-lighter">Placed on {formatDateTime(order.created_at)}</p>
        </div>
        <Badge variant={statusVariant} className="shrink-0">{customerStatus}</Badge>
      </motion.div>

      {order.status === "preorder" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-secondary/20 bg-secondary/[0.06] px-4 py-3">
          <Clock className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-charcoal">Pre-order reserved · Pay on delivery</p>
            <p className="text-xs text-charcoal-lighter mt-0.5">
              You&apos;ll pay the full amount as cash on delivery once this item is in stock and shipped
              {order.preorder_expected_date ? <> — expected around <span className="font-medium text-charcoal">{formatDateShort(order.preorder_expected_date)}</span></> : ""}.
            </p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Main — Items + Timeline */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          className="lg:col-span-3 space-y-4 sm:space-y-5"
        >
          {/* Items */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Order Items</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(order.items || []).map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
                  className="flex gap-3 sm:gap-4 group"
                >
                  <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-image-surface shrink-0">
                    <Image src={item.product_image || "https://placehold.co/80x80"} alt={item.product_name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="80px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-charcoal line-clamp-2">{item.product_name}</p>
                    {item.variant && <p className="text-[11px] sm:text-xs text-charcoal-lighter mt-0.5">{item.variant}</p>}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] sm:text-xs text-charcoal-lighter">Qty: {item.quantity}</p>
                      <p className="text-xs sm:text-sm font-semibold text-charcoal">{formatCurrency(Number(item.total_price))}</p>
                    </div>
                  </div>
                </motion.div>
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
            <CardHeader className="pb-3"><CardTitle className="text-base">{activeReturn ? (isExchange ? "Exchange Progress" : "Return Progress") : "Order Timeline"}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-0">
                {builtTimeline.map((step, i) => {
                  const isLast = i === builtTimeline.length - 1;
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={step.key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" }}
                      className="flex gap-4"
                    >
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0 transition-colors duration-300",
                          step.done ? "bg-secondary border-secondary text-white" : "bg-card border-border text-charcoal-lighter"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {!isLast && <div className={cn("w-0.5 h-8 transition-colors duration-300", step.done ? "bg-secondary" : "bg-border")} />}
                      </div>
                      <div className="pb-6 pt-1.5">
                        <p className={cn("text-sm font-medium", step.done ? "text-charcoal" : "text-charcoal-lighter")}>{step.label}</p>
                        {step.date && <p className="text-xs text-charcoal-lighter">{formatDateTime(step.date)}</p>}
                      </div>
                    </motion.div>
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

          {/* Return & Exchange history */}
          {orderReturns.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Return & Exchange History</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {orderReturns.map((r) => {
                  const RLABEL: Record<string, string> = {
                    requested: "Requested", approved: "Approved", pickup_scheduled: "Pickup Scheduled",
                    received: "Product Received", refund_in_progress: "Refund in Progress", refunded: "Refunded",
                    exchange_in_progress: "Replacement in Progress", exchange_shipped: "Replacement Shipped",
                    exchange_delivered: "Replacement Delivered", rejected: "Rejected",
                  };
                  const good = ["refunded", "exchange_delivered"].includes(r.status);
                  const bad = r.status === "rejected";
                  return (
                    <div key={r.id} className="rounded-xl border border-border/30 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-medium text-charcoal">{r.resolution === "exchange" ? "Exchange" : "Return"} · {r.reason_label || r.reason}</span>
                        <Badge variant={good ? "success" : bad ? "destructive" : "warning"} className="text-[9px]">{RLABEL[r.status] || r.status}</Badge>
                      </div>
                      {r.items && r.items.length > 0 && (
                        <p className="text-[11px] text-charcoal-lighter">{r.items.map((it) => `${it.name}${it.qty ? ` ×${it.qty}` : ""}`).join(", ")}</p>
                      )}
                      {r.description && <p className="text-[11px] text-charcoal-lighter mt-1 italic">&ldquo;{r.description}&rdquo;</p>}
                      {r.images && r.images.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {r.images.map((url, i) => (
                            <div key={i} className="relative h-12 w-12 rounded-lg overflow-hidden border border-border/30 bg-pearl shrink-0">
                              <Image src={url} alt={`Return photo ${i + 1}`} fill className="object-cover" sizes="48px" unoptimized={url.includes("/uploads/")} />
                            </div>
                          ))}
                        </div>
                      )}
                      {r.refund_amount ? <p className="text-[11px] text-charcoal-lighter mt-1.5">Refund: <span className="font-medium text-charcoal">{formatCurrency(Number(r.refund_amount))}</span></p> : null}
                      <p className="text-[10px] text-charcoal-lighter mt-1">{formatDateTime(r.created_at)}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Sidebar — Address + Payment */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
          className="lg:col-span-2 space-y-4 sm:space-y-5"
        >
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
                    <motion.button
                      onClick={() => handleCopy(order.transaction_id!)}
                      whileTap={{ scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      className="text-charcoal-lighter hover:text-secondary shrink-0 p-2"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </motion.button>
                    {copied && (
                      <motion.span
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[9px] text-success"
                      >
                        Copied
                      </motion.span>
                    )}
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
              {/* Buy Again — re-add this order's items to the cart (re-fetches
                  current prices/stock; skips anything no longer available). */}
              <Button
                className="w-full text-sm"
                disabled={reordering || order.items.length === 0}
                onClick={async () => {
                  setReorderNote("");
                  const res = await reorder(order.items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity })));
                  if (res.added === 0) {
                    setReorderNote(res.mixed ? "Your cart has pre-order items — check those out first." : "These items are no longer available.");
                  } else if (res.unavailable > 0 || res.mixed) {
                    setReorderNote(`${res.added} item${res.added > 1 ? "s" : ""} added${res.unavailable > 0 ? `, ${res.unavailable} unavailable` : ""}.`);
                  }
                }}
              >
                {reordering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Buy Again
              </Button>
              {reorderNote && <p className="text-[11px] text-charcoal-lighter text-center">{reorderNote}</p>}

              <Button variant="outline" className="w-full text-sm" onClick={() => window.open(`/invoice?id=${encodeURIComponent(order.order_number)}`, "_blank")}>Download Invoice</Button>

              {/* Cancel Order — only while the order is still cancellable */}
              {canCancel && (
                <Button variant="outline" className="w-full text-sm text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => { setCancelError(""); setCancelOpen(true); }}>
                  <XCircle className="h-3.5 w-3.5" /> Cancel Order
                </Button>
              )}

              {/* Return Section — smart eligibility */}
              {(() => {
                const status = order.status;
                const deliveredEntry = order.timeline.find((t) => t.status === "received");
                const daysSinceDelivery = deliveredEntry ? (Date.now() - new Date(deliveredEntry.created_at).getTime()) / (1000 * 60 * 60 * 24) : 999;
                const returnWindowDays = 7;
                const returnDeadline = deliveredEntry ? new Date(new Date(deliveredEntry.created_at).getTime() + returnWindowDays * 24 * 60 * 60 * 1000) : null;

                // Already submitted return
                // Active return status card (most-recent non-rejected). Multiple
                // returns can exist; the "request another" button below still
                // shows while other items remain returnable + in window.
                const activeCard = existingReturn ? (() => {
                  const s = existingReturn.status;
                  const good = ["refunded", "exchange_delivered"].includes(s);
                  const bad = s === "rejected";
                  const LABELS: Record<string, string> = {
                    requested: "Return Requested — Pending Review",
                    approved: "Return Approved — In Progress",
                    pickup_scheduled: "Pickup Scheduled",
                    received: "Product Received — Processing",
                    refund_in_progress: "Refund in Progress",
                    refunded: "Refund Completed",
                    exchange_in_progress: "Replacement in Progress",
                    exchange_shipped: "Replacement Shipped",
                    exchange_delivered: "Replacement Delivered",
                    rejected: "Return Request Rejected",
                  };
                  return (
                    <div className={cn("p-3 rounded-xl border", good ? "bg-success/10 border-success/20" : bad ? "bg-destructive/10 border-destructive/20" : "bg-amber-50 border-amber-200")}>
                      <div className="flex items-center gap-2 justify-center">
                        <RotateCcw className={cn("h-4 w-4", good ? "text-success" : bad ? "text-destructive" : "text-amber-600")} />
                        <p className={cn("text-xs font-medium", good ? "text-success" : bad ? "text-destructive" : "text-amber-700")}>{LABELS[s] || s}</p>
                      </div>
                      {existingReturn.refund_amount ? <p className="text-[10px] text-charcoal-lighter text-center mt-0.5">Refund: {formatCurrency(Number(existingReturn.refund_amount))}</p> : null}
                      {s === "requested" && (
                        <button onClick={() => handleWithdrawReturn(existingReturn.id)} disabled={withdrawing} className="mt-2 w-full text-[11px] text-destructive hover:underline">
                          {withdrawing ? "Withdrawing…" : "Withdraw this return"}
                        </button>
                      )}
                    </div>
                  );
                })() : null;

                // Request-return button: shown while delivered, within window,
                // and at least one line is still returnable.
                const canRequest = status === "received" && daysSinceDelivery <= returnWindowDays && returnableItems.length > 0;
                const requestBtn = canRequest ? (
                  <>
                    <Button variant="outline" className="w-full text-sm text-secondary border-secondary/30" onClick={openReturnDialog}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> {existingReturn ? "Return Other Items" : "Request Return"}
                    </Button>
                    <p className="text-[10px] text-charcoal-lighter text-center">
                      Return window closes {returnDeadline ? returnDeadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "soon"}
                    </p>
                  </>
                ) : null;

                if (activeCard || requestBtn) {
                  return <div className="space-y-2">{activeCard}{requestBtn}</div>;
                }

                // Order delivered but return window expired (and no active return)
                if (status === "received" && daysSinceDelivery > returnWindowDays) {
                  return (
                    <div className="p-3 rounded-xl bg-pearl/60 border border-border/20 text-center">
                      <p className="text-xs font-medium text-charcoal-lighter">Return Window Expired</p>
                      <p className="text-[10px] text-charcoal-lighter mt-0.5">Returns must be requested within {returnWindowDays} days of delivery. The window closed on {returnDeadline?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>
                    </div>
                  );
                }

                // Order delivered but return window expired
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
        </motion.div>
      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Cancel Order</DialogTitle>
            <DialogDescription>
              Cancel order {order?.order_number}? This can&apos;t be undone. If you&apos;ve already paid, a refund will be processed.
            </DialogDescription>
          </DialogHeader>
          {cancelError && <p className="text-sm text-destructive">{cancelError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>Keep Order</Button>
            <Button variant="secondary" className="!bg-destructive hover:!bg-destructive/90 !text-white" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Request Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-secondary" /> Request Return</DialogTitle>
            <DialogDescription>Order {order?.order_number} · returns accepted within {returnWindowDays} days of delivery.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Item picker — choose which items to return (whole line each) */}
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Items to return<span className="text-destructive"> *</span></label>
              <div className="space-y-2">
                {returnableItems.map((it) => {
                  const key = itemKey(it);
                  const checked = returnSelectedItems.includes(key);
                  return (
                    <label key={key} className={cn("flex items-center gap-3 rounded-lg border p-2 cursor-pointer transition-colors", checked ? "border-secondary bg-secondary/5" : "border-border/50 hover:bg-pearl/50")}>
                      <input type="checkbox" checked={checked} onChange={() => toggleReturnItem(key)} className="accent-secondary h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-charcoal truncate">{it.product_name}</p>
                        <p className="text-[11px] text-charcoal-lighter">{it.variant ? `${it.variant} · ` : ""}Qty {it.quantity} · {formatCurrency(it.unit_price * it.quantity)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Reason (configurable) */}
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Reason<span className="text-destructive"> *</span></label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {effectiveReasons.map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Description with live counter (capped) */}
            <div>
              <Textarea
                label="Description (optional)"
                value={returnDesc}
                onChange={(e) => setReturnDesc(e.target.value.slice(0, RETURN_DESC_MAX))}
                placeholder="Describe the issue (helps us process it faster)..."
                className="min-h-[80px]"
                maxLength={RETURN_DESC_MAX}
              />
              <p className="text-[10px] text-charcoal-lighter text-right mt-0.5 [font-variant-numeric:tabular-nums]">{returnDesc.length}/{RETURN_DESC_MAX}</p>
            </div>

            {/* Defect images (max 2) */}
            <div>
              <label className="block text-sm font-medium text-charcoal-light mb-1.5">Photos of the issue (optional)</label>
              <ReviewImageUpload value={returnImages} onChange={setReturnImages} max={2} folder="returns" />
            </div>

            {/* Refund preview */}
            {returnSelectedItems.length > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-pearl/60 px-3 py-2 text-sm">
                <span className="text-charcoal-lighter">Estimated refund</span>
                <span className="font-semibold text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(selectedSubtotal)}</span>
              </div>
            )}
            {returnError && <p className="text-xs text-destructive">{returnError}</p>}
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t border-border/20">
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button variant="secondary" className="!text-white" onClick={handleReturn} disabled={returnSubmitting || returnSelectedItems.length === 0 || !returnReason}>
              {returnSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Submit Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
