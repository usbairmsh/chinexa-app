"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShoppingBag, Heart, MapPin, Star, Package, Truck,
  CheckCircle2, Clock, ArrowRight, Gift, Loader2, Crown, MessageCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";

import { useAuthStore } from "@/stores/auth.store";
import { useCustomerBadge } from "@/hooks/use-customer-badge";
import { useChatStore } from "@/stores/chat.store";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { useWishlistStore } from "@/stores/wishlist.store";
import { formatCurrency, formatDateShort, cn } from "@/lib/utils";
import { resolveTierColorStyle } from "@/lib/tier-color";

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

interface OrderData {
  id: string; order_number: string; created_at: string; total: number;
  status: string; items?: { name: string; image: string; qty: number; price: number }[];
}

export default function AccountDashboard() {
  const shouldReduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const badgeData = useCustomerBadge();
  const wishlistCount = useWishlistStore((s) => s.items.length);
  const openChat = useChatStore((s) => s.openChat);

  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyTier, setLoyaltyTier] = useState<string | null>(null);
  const [tierColorRaw, setTierColorRaw] = useState<string | undefined>(undefined);
  const tierColor = resolveTierColorStyle(tierColorRaw);
  const [nextTierName, setNextTierName] = useState<string | null>(null);
  const [nextTierAt, setNextTierAt] = useState(0);
  const [pointsToNext, setPointsToNext] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalAddresses, setTotalAddresses] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user?.id) { setLoadingData(false); return; }
    setLoadingData(true);

    // Fetch membership data
    fetch(`/api/customers/${user.id}/points`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setLoyaltyPoints(data.total_points || 0);
          if (data.tier) {
            setLoyaltyTier(data.tier.name);
            setTierColorRaw(data.tier.color);
          }
          if (data.next_tier) {
            setNextTierName(data.next_tier.name);
            setNextTierAt(data.next_tier.min_points);
            setPointsToNext(data.points_to_next_tier);
          }
        }
      })
      .catch(() => {});

    // Fetch customer detail for orders + addresses
    fetch(`/api/customers/${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setTotalOrders(data.total_orders || 0);
          setTotalAddresses(data.addresses?.length || 0);
          if (data.orders) {
            setRecentOrders(data.orders.slice(0, 3));
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [user?.id, mounted]);

  const stats = [
    { label: "Total Orders", value: String(totalOrders), icon: ShoppingBag, color: "text-secondary bg-secondary/10", href: "/dashboard/orders" },
    // wishlist store is persisted — render 0 until mounted to match server HTML
    { label: "Wishlist", value: String(mounted ? wishlistCount || 0 : 0), icon: Heart, color: "text-coral bg-coral-light", href: "/dashboard/wishlist" },
    { label: "Addresses", value: String(totalAddresses), icon: MapPin, color: "text-blue-500 bg-blue-50", href: "/dashboard/addresses" },
    { label: "Points", value: loyaltyPoints.toLocaleString(), icon: Star, color: "text-gold bg-gold/10", href: "/dashboard/points" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}>
        <Card className="rounded-2xl bg-gradient-to-r from-secondary/10 via-primary-light to-coral-light border-0 overflow-hidden relative">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="relative z-10">
              {loyaltyTier && (
                <div className="mb-2">
                  <Badge className={cn("text-[10px] border-0 uppercase tracking-widest", tierColor.className)} style={tierColor.style}>
                    {loyaltyTier} Member
                  </Badge>
                </div>
              )}
              <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-bold text-charcoal mb-2 flex items-center gap-1.5 flex-wrap">
                {/* Gate on `mounted` — the persisted store differs from server HTML on refresh */}
                Welcome back, {mounted && user?.name ? user.name : "Beautiful"}!
                {badgeData?.badge_color && <VerifiedBadge color={badgeData.badge_color} opacity={badgeData.badge_opacity} size={22} tooltip={badgeData.badge_name} />}
                &#10024;
              </h2>
              <p className="text-sm text-charcoal-lighter max-w-md mb-4 flex items-center gap-2 flex-wrap">
                <span>You have {loyaltyPoints.toLocaleString()} loyalty points.{nextTierName ? ` Keep shopping to reach ${nextTierName} status.` : " You've reached the highest tier!"}</span>
                <Link href="/dashboard/points" className="text-secondary hover:text-secondary-dark font-medium text-xs whitespace-nowrap">
                  View Details →
                </Link>
              </p>
              {nextTierAt > 0 && (
                <div className="max-w-xs">
                  <div className="flex items-center justify-between text-[10px] text-charcoal-lighter mb-1">
                    <span>{loyaltyPoints.toLocaleString()} pts</span>
                    <span>{nextTierName} at {nextTierAt.toLocaleString()}</span>
                  </div>
                  <Progress value={nextTierAt > 0 ? Math.min(((loyaltyPoints) / nextTierAt) * 100, 100) : 100} />
                  <p className="text-[9px] text-charcoal-lighter mt-1">{pointsToNext} points to go</p>
                </div>
              )}
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.07] hidden sm:block">
              <Gift className="h-40 w-40 animate-float" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }} animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={stat.href}>
              <Card className="hover:shadow-card-hover hover:-translate-y-px active:scale-[0.98] transition-all cursor-pointer group">
                <CardContent className="p-4 text-center">
                  <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl mb-2 transition-transform duration-300 group-hover:scale-110", stat.color)}>
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
          {loadingData ? (
            <div className="flex items-center justify-center py-8 text-charcoal-lighter">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
            </div>
          ) : recentOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No orders yet"
              description="Start shopping to see your orders here."
              actionLabel="Start Shopping"
              actionHref="/products"
              className="py-8"
            />
          ) : recentOrders.map((order) => {
            const config = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            const displayId = order.order_number || order.id;
            const itemCount = order.items?.length || 0;
            return (
              <Link
                key={order.id}
                href={`/dashboard/orders/${displayId}`}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-pearl/70 active:scale-[0.99] transition-all group"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-pearl shrink-0">
                  <Package className="h-6 w-6 text-charcoal-lighter" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors truncate">{displayId}</p>
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0", config.color)}>
                      <StatusIcon className="h-3 w-3" /> {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal-lighter">{formatDateShort(order.created_at)} &middot; {itemCount} item{itemCount !== 1 ? "s" : ""}</p>
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
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/dashboard/membership">
          <Card className="hover:shadow-card-hover hover:-translate-y-px active:scale-[0.98] transition-all cursor-pointer group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10 shrink-0 transition-transform duration-300 group-hover:scale-110">
                <Crown className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors">Membership Benefits</p>
                <p className="text-[10px] text-charcoal-lighter">Levels & perks</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <button onClick={() => openChat("help_and_support")} className="text-left">
          <Card className="hover:shadow-card-hover hover:-translate-y-px active:scale-[0.98] transition-all cursor-pointer group h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10 shrink-0 transition-transform duration-300 group-hover:scale-110">
                <MessageCircle className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors">Get Help</p>
                <p className="text-[10px] text-charcoal-lighter">Chat with our team</p>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>
    </div>
  );
}
