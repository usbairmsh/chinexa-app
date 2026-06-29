"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ShoppingBag, Heart, MapPin, Star, Package, Truck,
  CheckCircle2, Clock, ArrowRight, Gift, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuthStore } from "@/stores/auth.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { formatCurrency, cn } from "@/lib/utils";

const recentOrders = [
  { id: "ORD-0527", date: "Jun 28, 2026", total: 8500, status: "processing", items: 2, image: "https://picsum.photos/seed/order-1/80/80" },
  { id: "ORD-0519", date: "Jun 20, 2026", total: 12400, status: "received", items: 3, image: "https://picsum.photos/seed/order-2/80/80" },
  { id: "ORD-0512", date: "Jun 15, 2026", total: 4800, status: "received", items: 1, image: "https://picsum.photos/seed/order-3/80/80" },
];

// Customer-friendly labels
const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Order Placed", color: "text-warning bg-warning/10", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-blue-500 bg-blue-50", icon: CheckCircle2 },
  processing: { label: "Processing", color: "text-secondary bg-secondary/10", icon: Package },
  shipped: { label: "Shipped", color: "text-violet-500 bg-violet-50", icon: Truck },
  on_delivery: { label: "Out for Delivery", color: "text-indigo-500 bg-indigo-50", icon: Truck },
  received: { label: "Delivered", color: "text-success bg-success/10", icon: CheckCircle2 },
  not_received: { label: "Delivery Failed", color: "text-destructive bg-destructive/10", icon: Clock },
};

const loyaltyPoints = 2450;
const loyaltyTier = "Gold";
const nextTierAt = 5000;

export default function AccountDashboard() {
  const user = useAuthStore((s) => s.user);
  const wishlistCount = useWishlistStore((s) => s.items.length);

  const stats = [
    { label: "Total Orders", value: "12", icon: ShoppingBag, color: "text-secondary bg-secondary/10", href: "/dashboard/orders" },
    { label: "Wishlist", value: String(wishlistCount || 3), icon: Heart, color: "text-coral bg-coral-light", href: "/dashboard/wishlist" },
    { label: "Addresses", value: "2", icon: MapPin, color: "text-blue-500 bg-blue-50", href: "/dashboard/addresses" },
    { label: "Reviews", value: "5", icon: Star, color: "text-gold bg-gold/10", href: "/dashboard/orders" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-r from-secondary/10 via-primary-light to-coral-light border-0 overflow-hidden relative">
          <CardContent className="p-6 sm:p-8">
            <div className="relative z-10">
              <p className="text-xs font-medium text-secondary uppercase tracking-widest mb-1">
                {loyaltyTier} Member
              </p>
              <h2 className="font-heading text-xl sm:text-2xl font-semibold text-charcoal mb-2">
                Welcome back, {user?.name || "Beautiful"}! &#10024;
              </h2>
              <p className="text-sm text-charcoal-lighter max-w-md mb-4">
                You have {loyaltyPoints.toLocaleString()} loyalty points. Keep shopping to unlock exclusive rewards and reach Platinum status.
              </p>
              <div className="max-w-xs">
                <div className="flex items-center justify-between text-[10px] text-charcoal-lighter mb-1">
                  <span>{loyaltyPoints.toLocaleString()} pts</span>
                  <span>Platinum at {nextTierAt.toLocaleString()}</span>
                </div>
                <Progress value={(loyaltyPoints / nextTierAt) * 100} />
              </div>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.07] hidden sm:block">
              <Gift className="h-40 w-40" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={stat.href}>
              <Card className="hover:shadow-card-hover transition-all cursor-pointer group">
                <CardContent className="p-4 text-center">
                  <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl mb-2", stat.color)}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <p className="text-xl font-bold text-charcoal group-hover:text-secondary transition-colors">{stat.value}</p>
                  <p className="text-[10px] text-charcoal-lighter">{stat.label}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <Link href="/dashboard/orders" className="text-xs text-secondary hover:text-secondary-dark flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentOrders.map((order) => {
            const config = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Link
                key={order.id}
                href={`/dashboard/orders/${order.id}`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-pearl/70 transition-colors group"
              >
                <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-pearl shrink-0">
                  <Image src={order.image} alt={order.id} fill className="object-cover" sizes="56px" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors">{order.id}</p>
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full", config.color)}>
                      <StatusIcon className="h-3 w-3" /> {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal-lighter">{order.date} &middot; {order.items} items</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-charcoal">{formatCurrency(order.total)}</p>
                  <ArrowRight className="h-3.5 w-3.5 text-charcoal-lighter ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Link href="/dashboard/orders">
          <Card className="hover:shadow-card-hover transition-all cursor-pointer group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 shrink-0">
                <Truck className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors">Track Orders</p>
                <p className="text-[10px] text-charcoal-lighter">View delivery status</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/addresses">
          <Card className="hover:shadow-card-hover transition-all cursor-pointer group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 shrink-0">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors">Manage Addresses</p>
                <p className="text-[10px] text-charcoal-lighter">Add or edit addresses</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/profile">
          <Card className="hover:shadow-card-hover transition-all cursor-pointer group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 shrink-0">
                <TrendingUp className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors">Edit Profile</p>
                <p className="text-[10px] text-charcoal-lighter">Update your details</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
