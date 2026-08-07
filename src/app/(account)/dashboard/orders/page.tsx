"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Package, Truck, CheckCircle2, Clock, XCircle, MapPin, PackageCheck, ThumbsDown, LocateFixed, RotateCcw, Loader2 } from "lucide-react";
import { useReorder } from "@/hooks/use-reorder";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/stores/auth.store";
import { PayNow, isAwaitingPayment } from "@/components/storefront/orders/pay-now";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";

interface OrderItem {
  product_id?: string; variant_id?: string | null;
  name: string; image: string; qty: number; price: number;
}

interface Order {
  id: string; order_number: string; created_at: string; total: number;
  status: string; payment_method?: string; payment_status?: string;
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock; badge: "warning" | "secondary" | "success" | "destructive" | "default" }> = {
  preorder: { label: "Pre-order — Reserved", color: "text-secondary bg-secondary/10", icon: Clock, badge: "secondary" },
  pending: { label: "Order Placed", color: "text-warning bg-warning/10", icon: Clock, badge: "warning" },
  confirmed: { label: "Confirmed", color: "text-secondary bg-secondary/10", icon: CheckCircle2, badge: "default" },
  processing: { label: "Processing", color: "text-secondary bg-secondary/10", icon: Package, badge: "secondary" },
  shipped: { label: "Shipped", color: "text-secondary bg-secondary/10", icon: Truck, badge: "secondary" },
  on_delivery: { label: "Out for Delivery", color: "text-secondary bg-secondary/10", icon: MapPin, badge: "secondary" },
  received: { label: "Delivered", color: "text-success bg-success/10", icon: PackageCheck, badge: "success" },
  not_received: { label: "Delivery Failed", color: "text-destructive bg-destructive/10", icon: ThumbsDown, badge: "destructive" },
  // Archiving an order sets its status to 'cancelled'; a processed return sets
  // 'returned'. Without these entries the list fell back to "Order Placed",
  // so a cancelled/archived order wrongly appeared as still pending here.
  cancelled: { label: "Cancelled", color: "text-destructive bg-destructive/10", icon: XCircle, badge: "destructive" },
  returned: { label: "Returned", color: "text-warning bg-warning/10", icon: RotateCcw, badge: "warning" },
};

function OrderCard({ order, customerId, onCancelled }: { order: Order; customerId?: string; onCancelled?: (orderId: string) => void }) {
  const config = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const displayId = order.order_number || order.id;
  const { reorder, reordering } = useReorder();
  const [reorderNote, setReorderNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const canCancel = ["preorder", "pending", "confirmed", "processing"].includes(order.status);

  const handleCancel = async () => {
    if (!customerId) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't cancel this order");
      setCancelOpen(false);
      onCancelled?.(order.id);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Couldn't cancel this order");
    } finally { setCancelling(false); }
  };

  const handleReorder = async () => {
    setReorderNote("");
    const lines = order.items
      .filter((i) => i.product_id)
      .map((i) => ({ product_id: i.product_id as string, variant_id: i.variant_id, quantity: i.qty }));
    if (lines.length === 0) { setReorderNote("Item details unavailable for reorder."); return; }
    const res = await reorder(lines);
    if (res.added === 0) {
      setReorderNote(res.mixed ? "Check out pre-order items first." : "No longer available.");
    } else if (res.unavailable > 0 || res.mixed) {
      setReorderNote(`${res.added} added${res.unavailable > 0 ? `, ${res.unavailable} unavailable` : ""}.`);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-pearl/50 border-b border-border/20">
          <div className="flex items-center gap-3 sm:gap-6 text-xs">
            <div>
              <p className="text-[10px] text-charcoal-lighter uppercase tracking-wider">Order</p>
              <p className="font-semibold text-charcoal">{displayId}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] text-charcoal-lighter uppercase tracking-wider">Date</p>
              <p className="text-charcoal">{formatDateShort(order.created_at)}</p>
            </div>
            {order.payment_method && (
              <div className="hidden sm:block">
                <p className="text-[10px] text-charcoal-lighter uppercase tracking-wider">Payment</p>
                <p className="text-charcoal capitalize">{order.payment_method}</p>
              </div>
            )}
          </div>
          <Badge variant={config.badge} className="text-[10px]">
            <StatusIcon className="h-3 w-3 mr-1" /> {config.label}
          </Badge>
        </div>

        <div className="px-4 sm:px-5 py-3 space-y-3">
          {order.items.length > 0 ? order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-pearl shrink-0">
                <Package className="h-5 w-5 text-charcoal-lighter" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-charcoal truncate">{item.name}</p>
                <p className="text-[10px] text-charcoal-lighter">Qty: {item.qty}</p>
              </div>
              <p className="text-sm font-medium text-charcoal shrink-0">{formatCurrency(item.price)}</p>
            </div>
          )) : (
            <p className="text-xs text-charcoal-lighter py-2">Order items</p>
          )}
        </div>

        {/* Awaiting online payment — retry with the live window countdown. */}
        {isAwaitingPayment(order) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-t border-border/20 bg-warning/5">
            <p className="text-xs font-medium text-charcoal">Payment not completed</p>
            <PayNow
              orderId={order.id}
              createdAt={order.created_at}
              customerId={customerId}
              compact
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3 border-t border-border/20">
          <p className="text-sm">
            <span className="text-charcoal-lighter">Total: </span>
            <span className="font-semibold text-charcoal">{formatCurrency(order.total)}</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <Button size="sm" onClick={handleReorder} disabled={reordering}>
              {reordering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Buy Again
            </Button>
            <Link href={`/track-order?order=${encodeURIComponent(displayId)}`}>
              <Button variant="outline" size="sm">
                <LocateFixed className="h-3.5 w-3.5" /> Track Order
              </Button>
            </Link>
            <Link href={`/dashboard/orders/${displayId}`}>
              <Button variant="ghost" size="sm">
                View Details &rarr;
              </Button>
            </Link>
            {canCancel && (
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/5" onClick={() => { setCancelError(""); setCancelOpen(true); }}>
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>
        </div>
        {reorderNote && <p className="px-4 sm:px-5 pb-3 -mt-1 text-[11px] text-charcoal-lighter text-right">{reorderNote}</p>}
      </CardContent>

      {/* Cancel confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> Cancel Order</DialogTitle>
            <DialogDescription>
              Cancel order {displayId}? This can&apos;t be undone. If you&apos;ve already paid, a refund will be processed.
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
    </Card>
  );
}

export default function OrdersPage() {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/customers/${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.orders) {
          setOrders(data.orders.map((o: Record<string, unknown>) => ({
            id: o.id as string,
            order_number: (o.order_number as string) || (o.id as string),
            created_at: (o.created_at as string) || "",
            total: Number(o.total),
            status: (o.status as string) || "pending",
            payment_method: (o.payment_method as string) || undefined,
            payment_status: (o.payment_status as string) || undefined,
            items: Array.isArray(o.items) ? o.items : [],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id, mounted]);

  // Reflect a cancellation immediately without a full refetch — flip that order
  // to cancelled so it drops out of Active and into the Failed tab.
  const markCancelled = (orderId: string) =>
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" } : o)));

  const activeOrders = orders.filter(o => ["preorder", "pending", "confirmed", "processing", "shipped", "on_delivery"].includes(o.status));
  const completedOrders = orders.filter(o => o.status === "received");
  // Failed/closed: delivery failed, cancelled (incl. admin-archived), or returned.
  const failedOrders = orders.filter(o => ["not_received", "cancelled", "returned"].includes(o.status));

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-luxury border border-border/40 shadow-card p-4">
            <div className="h-4 w-32 bg-pearl rounded animate-pulse mb-3" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-pearl rounded-lg animate-pulse shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-48 bg-pearl rounded animate-pulse mb-1.5" />
                  <div className="h-2.5 w-20 bg-pearl rounded animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-pearl rounded-lg animate-pulse shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-40 bg-pearl rounded animate-pulse mb-1.5" />
                  <div className="h-2.5 w-16 bg-pearl rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-charcoal">My Orders</h2>
        <p className="text-xs text-charcoal-lighter">{orders.length} order{orders.length !== 1 ? "s" : ""}</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="w-full sm:w-auto overflow-x-auto scrollbar-hide">
          <TabsTrigger value="all" className="text-xs sm:text-sm px-2.5 sm:px-4">All ({orders.length})</TabsTrigger>
          <TabsTrigger value="active" className="text-xs sm:text-sm px-2.5 sm:px-4">Active ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs sm:text-sm px-2.5 sm:px-4">Delivered ({completedOrders.length})</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs sm:text-sm px-2.5 sm:px-4">Failed ({failedOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="space-y-4">
            {orders.length === 0 ? (
              <EmptyState icon={Package} title="No orders yet" description="Your orders will appear here when you shop" actionLabel="Start Shopping" actionHref="/products" />
            ) : orders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <OrderCard order={order} customerId={user?.id} onCancelled={markCancelled} />
              </motion.div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="active">
          <div className="space-y-4">
            {activeOrders.length === 0 ? (
              <EmptyState icon={Package} title="No active orders" description="Your active orders will appear here" actionLabel="Start Shopping" actionHref="/products" />
            ) : activeOrders.map((o, i) => (
              <motion.div
                key={o.id}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <OrderCard order={o} customerId={user?.id} onCancelled={markCancelled} />
              </motion.div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="completed">
          <div className="space-y-4">
            {completedOrders.length === 0 ? (
              <EmptyState icon={PackageCheck} title="No deliveries yet" description="Completed orders will show here" />
            ) : completedOrders.map((o, i) => (
              <motion.div
                key={o.id}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <OrderCard order={o} customerId={user?.id} onCancelled={markCancelled} />
              </motion.div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="failed">
          <div className="space-y-4">
            {failedOrders.length === 0 ? (
              <EmptyState icon={ThumbsDown} title="No issues" description="All your orders have been received successfully" />
            ) : failedOrders.map((o, i) => (
              <motion.div
                key={o.id}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <OrderCard order={o} customerId={user?.id} onCancelled={markCancelled} />
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
