"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Package, Truck, CheckCircle2, Clock, XCircle, MapPin, PackageCheck, ThumbsDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";

const allOrders = [
  { id: "ORD-0527", date: "Jun 28, 2026", total: 8500, status: "processing", items: [
    { name: "CosRX Vitamin C Serum", image: "https://picsum.photos/seed/oi-1/80/80", qty: 1, price: 3200 },
    { name: "Laneige Water Sleeping Mask", image: "https://picsum.photos/seed/oi-2/80/80", qty: 1, price: 4500 },
  ], payment: "bKash" },
  { id: "ORD-0519", date: "Jun 20, 2026", total: 12400, status: "shipped", items: [
    { name: "Aria Leather Tote", image: "https://picsum.photos/seed/oi-3/80/80", qty: 1, price: 8900 },
    { name: "Aurora Pendant Necklace", image: "https://picsum.photos/seed/oi-4/80/80", qty: 1, price: 2500 },
    { name: "Cherry Blossom Body Mist", image: "https://picsum.photos/seed/oi-5/80/80", qty: 1, price: 1800 },
  ], payment: "COD" },
  { id: "ORD-0512", date: "Jun 15, 2026", total: 4800, status: "received", items: [
    { name: "SOME BY MI Niacinamide Serum", image: "https://picsum.photos/seed/oi-6/80/80", qty: 2, price: 2400 },
  ], payment: "Nagad" },
  { id: "ORD-0505", date: "Jun 10, 2026", total: 18900, status: "received", items: [
    { name: "Midnight Rose EDP 100ml", image: "https://picsum.photos/seed/oi-7/80/80", qty: 1, price: 8500 },
    { name: "Grace Ballet Flat", image: "https://picsum.photos/seed/oi-8/80/80", qty: 1, price: 6200 },
    { name: "Bloom Drop Earrings", image: "https://picsum.photos/seed/oi-9/80/80", qty: 1, price: 3200 },
  ], payment: "Card" },
  { id: "ORD-0498", date: "Jun 5, 2026", total: 6200, status: "received", items: [
    { name: "Innisfree Green Tea Seed Serum", image: "https://picsum.photos/seed/oi-10/80/80", qty: 1, price: 3800 },
    { name: "Centella Sheet Mask Pack", image: "https://picsum.photos/seed/oi-11/80/80", qty: 1, price: 1200 },
  ], payment: "bKash" },
  { id: "ORD-0489", date: "May 28, 2026", total: 3200, status: "not_received", items: [
    { name: "Belle Crossbody", image: "https://picsum.photos/seed/oi-12/80/80", qty: 1, price: 4200 },
  ], payment: "COD" },
  { id: "ORD-0475", date: "May 20, 2026", total: 15600, status: "received", items: [
    { name: "SK-II Facial Treatment Essence", image: "https://picsum.photos/seed/oi-13/80/80", qty: 1, price: 12000 },
    { name: "Rice Water Bright Toner", image: "https://picsum.photos/seed/oi-14/80/80", qty: 1, price: 1800 },
  ], payment: "Card" },
];

// Customer-friendly labels — "received" shows as "Delivered" to customers
const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock; badge: "warning" | "secondary" | "success" | "destructive" | "default" }> = {
  pending: { label: "Order Placed", color: "text-warning bg-warning/10", icon: Clock, badge: "warning" },
  confirmed: { label: "Confirmed", color: "text-blue-500 bg-blue-50", icon: CheckCircle2, badge: "default" },
  processing: { label: "Processing", color: "text-secondary bg-secondary/10", icon: Package, badge: "secondary" },
  shipped: { label: "Shipped", color: "text-violet-500 bg-violet-50", icon: Truck, badge: "secondary" },
  on_delivery: { label: "Out for Delivery", color: "text-indigo-500 bg-indigo-50", icon: MapPin, badge: "secondary" },
  received: { label: "Delivered", color: "text-success bg-success/10", icon: PackageCheck, badge: "success" },
  not_received: { label: "Delivery Failed", color: "text-destructive bg-destructive/10", icon: ThumbsDown, badge: "destructive" },
};

function OrderCard({ order }: { order: typeof allOrders[0] }) {
  const config = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Order Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-pearl/50 border-b border-border/20">
          <div className="flex items-center gap-3 sm:gap-6 text-xs">
            <div>
              <p className="text-[10px] text-charcoal-lighter uppercase tracking-wider">Order</p>
              <p className="font-semibold text-charcoal">{order.id}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] text-charcoal-lighter uppercase tracking-wider">Date</p>
              <p className="text-charcoal">{order.date}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] text-charcoal-lighter uppercase tracking-wider">Payment</p>
              <p className="text-charcoal">{order.payment}</p>
            </div>
          </div>
          <Badge variant={config.badge} className="text-[10px]">
            <StatusIcon className="h-3 w-3 mr-1" /> {config.label}
          </Badge>
        </div>

        {/* Items */}
        <div className="px-4 sm:px-5 py-3 space-y-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-pearl shrink-0">
                <Image src={item.image} alt={item.name} fill className="object-cover" sizes="48px" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-charcoal truncate">{item.name}</p>
                <p className="text-[10px] text-charcoal-lighter">Qty: {item.qty}</p>
              </div>
              <p className="text-sm font-medium text-charcoal shrink-0">{formatCurrency(item.price)}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-border/20">
          <p className="text-sm">
            <span className="text-charcoal-lighter">Total: </span>
            <span className="font-semibold text-charcoal">{formatCurrency(order.total)}</span>
          </p>
          <div className="flex gap-2">
            {order.status === "received" && (
              <Link href={`/dashboard/orders/${order.id}`}>
                <button className="text-xs text-secondary hover:text-secondary-dark font-medium transition-colors">
                  Write Review
                </button>
              </Link>
            )}
            <Link href={`/dashboard/orders/${order.id}`}>
              <button className="text-xs text-charcoal-lighter hover:text-charcoal font-medium transition-colors">
                View Details &rarr;
              </button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const activeOrders = allOrders.filter(o => ["pending", "confirmed", "processing", "shipped", "on_delivery"].includes(o.status));
  const completedOrders = allOrders.filter(o => o.status === "received");
  const notReceivedOrders = allOrders.filter(o => o.status === "not_received");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-charcoal">My Orders</h2>
        <p className="text-xs text-charcoal-lighter">{allOrders.length} orders</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">All ({allOrders.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="completed">Delivered ({completedOrders.length})</TabsTrigger>
          <TabsTrigger value="not_received">Failed ({notReceivedOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="space-y-4">
            {allOrders.map((order, i) => (
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
            ) : activeOrders.map((order) => <OrderCard key={order.id} order={order} />)}
          </div>
        </TabsContent>
        <TabsContent value="completed">
          <div className="space-y-4">
            {completedOrders.map((order) => <OrderCard key={order.id} order={order} />)}
          </div>
        </TabsContent>
        <TabsContent value="not_received">
          <div className="space-y-4">
            {notReceivedOrders.length === 0 ? (
              <EmptyState icon={ThumbsDown} title="No issues" description="All your orders have been received successfully" />
            ) : notReceivedOrders.map((order) => <OrderCard key={order.id} order={order} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
