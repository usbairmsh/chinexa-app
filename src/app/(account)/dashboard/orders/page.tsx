"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Package, Truck, CheckCircle2, Clock, XCircle, MapPin, PackageCheck, ThumbsDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/stores/auth.store";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";

interface OrderItem {
  name: string; image: string; qty: number; price: number;
}

interface Order {
  id: string; order_number: string; created_at: string; total: number;
  status: string; payment_method?: string;
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock; badge: "warning" | "secondary" | "success" | "destructive" | "default" }> = {
  pending: { label: "Order Placed", color: "text-warning bg-warning/10", icon: Clock, badge: "warning" },
  confirmed: { label: "Confirmed", color: "text-blue-500 bg-blue-50", icon: CheckCircle2, badge: "default" },
  processing: { label: "Processing", color: "text-secondary bg-secondary/10", icon: Package, badge: "secondary" },
  shipped: { label: "Shipped", color: "text-violet-500 bg-violet-50", icon: Truck, badge: "secondary" },
  on_delivery: { label: "Out for Delivery", color: "text-indigo-500 bg-indigo-50", icon: MapPin, badge: "secondary" },
  received: { label: "Delivered", color: "text-success bg-success/10", icon: PackageCheck, badge: "success" },
  not_received: { label: "Delivery Failed", color: "text-destructive bg-destructive/10", icon: ThumbsDown, badge: "destructive" },
};

function OrderCard({ order }: { order: Order }) {
  const config = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const displayId = order.order_number || order.id;

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

        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-border/20">
          <p className="text-sm">
            <span className="text-charcoal-lighter">Total: </span>
            <span className="font-semibold text-charcoal">{formatCurrency(order.total)}</span>
          </p>
          <Link href={`/dashboard/orders/${displayId}`}>
            <button className="text-xs text-charcoal-lighter hover:text-charcoal font-medium transition-colors">
              View Details &rarr;
            </button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const user = useAuthStore((s) => s.user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
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
            items: Array.isArray(o.items) ? o.items : [],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const activeOrders = orders.filter(o => ["pending", "confirmed", "processing", "shipped", "on_delivery"].includes(o.status));
  const completedOrders = orders.filter(o => o.status === "received");
  const failedOrders = orders.filter(o => o.status === "not_received");

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/20 p-4">
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
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">All ({orders.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="completed">Delivered ({completedOrders.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failedOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="space-y-4">
            {orders.length === 0 ? (
              <EmptyState icon={Package} title="No orders yet" description="Your orders will appear here when you shop" actionLabel="Start Shopping" actionHref="/products" />
            ) : orders.map((order, i) => (
              <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <OrderCard order={order} />
              </motion.div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="active">
          <div className="space-y-4">
            {activeOrders.length === 0 ? (
              <EmptyState icon={Package} title="No active orders" description="Your active orders will appear here" actionLabel="Start Shopping" actionHref="/products" />
            ) : activeOrders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </TabsContent>
        <TabsContent value="completed">
          <div className="space-y-4">
            {completedOrders.length === 0 ? (
              <EmptyState icon={PackageCheck} title="No deliveries yet" description="Completed orders will show here" />
            ) : completedOrders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </TabsContent>
        <TabsContent value="failed">
          <div className="space-y-4">
            {failedOrders.length === 0 ? (
              <EmptyState icon={ThumbsDown} title="No issues" description="All your orders have been received successfully" />
            ) : failedOrders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
