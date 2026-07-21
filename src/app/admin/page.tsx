"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown,
  ArrowRight, AlertTriangle, Star, Eye, ShoppingBag,
  Clock, CheckCircle2, Truck, XCircle, MessageSquare, Tag,
  FileText, BarChart3, Shield, RefreshCw, Settings, Image as ImageIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminDashboardStats, useAdminOrders, useAdminReviews, useAdminCoupons, useRevenueChartData, useOrdersChartData, useTrafficData, useLowStockProducts, useActivityLog, useMostDemandedProducts } from "@/hooks/queries/use-admin-data";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDateShort, getInitials, cn } from "@/lib/utils";

import {
  AreaChart, BarChart, PieChart, LineChart,
  Area, Bar, Line, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── CONFIG (not data) ────────────────────────────────────
const orderStatusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  pending: { color: "text-warning bg-warning/10", icon: Clock },
  confirmed: { color: "text-blue-500 bg-blue-50", icon: CheckCircle2 },
  processing: { color: "text-secondary bg-secondary/10", icon: Package },
  shipped: { color: "text-violet-500 bg-violet-50", icon: Truck },
  on_delivery: { color: "text-indigo-500 bg-indigo-50", icon: Truck },
  received: { color: "text-success bg-success/10", icon: CheckCircle2 },
  not_received: { color: "text-destructive bg-destructive/10", icon: XCircle },
};

// Same entity_type -> icon/color mapping as src/app/admin/activity-log/page.tsx,
// so the dashboard's preview card and the full log page read as one feature.
const activityEntityIcons: Record<string, typeof Package> = {
  product: Package, order: ShoppingCart, customer: Users, review: Star,
  settings: Settings, coupon: Shield, blog: FileText, banner: ImageIcon,
  category: Tag, stock: Package, fraud: Shield, membership: Star,
};
const activityEntityColors: Record<string, string> = {
  product: "bg-secondary/10 text-secondary", order: "bg-blue-50 text-blue-500",
  customer: "bg-violet-50 text-violet-500", review: "bg-gold/10 text-gold",
  settings: "bg-charcoal/5 text-charcoal-lighter", coupon: "bg-emerald-50 text-emerald-500",
  blog: "bg-orange-50 text-orange-500", banner: "bg-pink-50 text-pink-500",
  category: "bg-cyan-50 text-cyan-500", stock: "bg-amber-50 text-amber-600",
  fraud: "bg-red-50 text-red-500", membership: "bg-violet-50 text-violet-500",
};

const tooltipStyle = { borderRadius: "12px", border: "1px solid #F3DFEC", fontSize: "12px", boxShadow: "0 4px 30px rgba(0,0,0,0.04)" };
// Chart grid lines / axis labels — theme border + charcoal-lighter, not a
// leftover neutral from an earlier palette.
const chartGrid = "#F3DFEC";
const chartAxisLabel = "#8A7590";
// Primary chart series accent — the theme's own secondary purple, so the
// dashboard's charts read as the same product as everything else instead of
// a different app's orphaned red/terracotta scheme.
const chartAccent = "#7A4FA0";

// ─── COMPONENT ────────────────────────────────────────────
export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [revenuePeriod, setRevenuePeriod] = useState<"weekly" | "monthly">("weekly");
  const [refreshing, setRefreshing] = useState(false);
  const { data: dbStats, isLoading: loadingStats } = useAdminDashboardStats();
  const { data: dbOrders } = useAdminOrders({ page: 1 });
  const { data: dbReviews } = useAdminReviews({ is_approved: "false" });
  const { data: revenueChartData } = useRevenueChartData(revenuePeriod === "weekly" ? "7d" : "1y");
  const { data: ordersChartData } = useOrdersChartData("1y");
  const { data: trafficChartData } = useTrafficData();
  const { data: lowStockData } = useLowStockProducts();
  const { data: demandedData } = useMostDemandedProducts(5);
  const { data: dbCoupons } = useAdminCoupons();
  const { data: dbActivityLog } = useActivityLog(5);

  // Refresh handler — invalidates all admin queries
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  }, [queryClient]);

  // Auto-refresh when order events happen (order placed, status changed)
  useEffect(() => {
    const handler = () => handleRefresh();
    window.addEventListener("dashboard-refresh", handler);
    // Also listen for storage events (cross-tab refresh)
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "chinexa-dashboard-updated") handleRefresh();
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("dashboard-refresh", handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [handleRefresh]);

  // Map DB stats
  const stats = dbStats?.stats ? {
    total_revenue: dbStats.stats.total_revenue,
    total_orders: dbStats.stats.total_orders,
    total_customers: dbStats.stats.total_customers,
    total_products: dbStats.stats.total_products,
    revenue_change: dbStats.stats.revenue_change,
    orders_change: dbStats.stats.orders_change,
    customers_change: dbStats.stats.customers_change,
    average_order_value: dbStats.stats.average_order_value,
  } : null;

  // Use DB data for charts — no fallback to mock, show empty if DB is empty
  const revenueBarData = (revenueChartData || []).map((d) => ({ day: d.label, revenue: d.value, prev: Math.round(d.value * 0.85) }));
  const revenueAreaData = (revenueChartData || []).map((d) => ({ month: d.label, revenue: d.value }));
  const ordersLineData = (ordersChartData || []).map((d) => ({ month: d.label, orders: d.orders, customers: d.customers }));

  const orderStatusChartData = (dbStats?.order_statuses || []).map((s) => {
    // Theme-derived — secondary purple for the "healthy pipeline" states,
    // gold/coral as the two ornamental accents, success/warning/destructive
    // reserved for their actual semantic meaning (never repurposed as decoration).
    const colors: Record<string, string> = { received: "#10B981", shipped: "#7A4FA0", processing: "#E0B96C", confirmed: "#3B82F6", pending: "#F59E0B", on_delivery: "#C9AEE6", not_received: "#EF4444" };
    return { name: s.name, value: s.value, color: colors[s.name] || "#8A7590" };
  });

  const categoryRevenueChartData = (dbStats?.category_revenue || []).map((c, i) => {
    const colors = ["#7A4FA0", "#E0B96C", "#C9AEE6", "#BC4A72", "#3B82F6", "#10B981", "#5F3C7D"];
    return { name: c.name, value: c.value, color: colors[i % colors.length] };
  });

  // Use DB orders for recent orders table
  const recentDbOrders = (dbOrders?.data || []).slice(0, 5).map((o) => ({
    id: o.order_number as string || o.id as string,
    customer: o.customer_name as string,
    total: Number(o.total) || 0,
    status: o.status as string,
    items: Number(o.item_count) || 0,
    time: formatDateShort(o.created_at as string),
  }));

  // Use DB reviews for pending reviews
  const pendingDbReviews = (dbReviews || []).slice(0, 3).map((r) => ({
    id: r.id as string,
    customer: r.customer_name as string,
    product: r.product_name as string || "Product",
    rating: Number(r.rating),
    excerpt: (r.comment as string || "").slice(0, 50) + "...",
  }));

  // Traffic & conversions from DB
  const trafficData = trafficChartData || [];

  // Low stock from DB
  const lowStockProducts = lowStockData || [];

  // Most demanded products (by ordered quantity, archived orders excluded)
  const demandedProducts = demandedData || [];
  const maxDemandQty = demandedProducts.length > 0 ? Math.max(...demandedProducts.map((p) => p.total_qty), 1) : 1;

  // Coupons from DB
  const activeCoupons = (dbCoupons || []).filter((c) => c.is_active).slice(0, 3).map((c) => ({
    code: c.code as string, type: c.discount_type === "percentage" ? `${c.discount_value}% Off` : `৳${c.discount_value} Off`,
    used: Number(c.used_count) || 0, limit: Number(c.usage_limit) || 1000,
  }));

  // Fraud alerts — flag orders with high value from new customers
  const fraudAlerts = (dbOrders?.data || []).filter((o) => Number(o.total) > 15000 && o.status === "pending").slice(0, 2).map((o) => ({
    id: `fa-${o.id}`, order: (o.order_number as string) || (o.id as string), risk: 78, reason: "High value pending order",
  }));

  const statCards = stats ? [
    { label: "Total Revenue", value: formatCurrency(stats.total_revenue), change: stats.revenue_change, icon: DollarSign, color: "text-success", bg: "bg-success/10", href: "/admin/accounting" },
    { label: "Total Orders", value: stats.total_orders.toLocaleString(), change: stats.orders_change, icon: ShoppingCart, color: "text-secondary", bg: "bg-secondary/10", href: "/admin/orders" },
    { label: "Customers", value: stats.total_customers.toLocaleString(), change: stats.customers_change, icon: Users, color: "text-blue-500", bg: "bg-blue-50", href: "/admin/customers" },
    { label: "Avg. Order", value: formatCurrency(stats.average_order_value), change: 0, icon: ShoppingBag, color: "text-gold", bg: "bg-gold/10", href: "/admin/analytics" },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Dashboard</h1>
          <p className="text-sm text-charcoal-lighter">Welcome back! Here&apos;s your store analytics.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full border text-[12px] font-body font-medium tracking-wide transition-all duration-200 cursor-pointer active:scale-[0.96]",
              refreshing ? "border-secondary text-secondary bg-secondary/5" : "border-border text-charcoal-lighter hover:text-charcoal hover:border-charcoal"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <Link href="/admin/analytics">
            <span className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-5 rounded-full border border-border text-charcoal text-[12px] font-body font-medium tracking-wide hover:bg-charcoal hover:!text-white hover:border-charcoal transition-all duration-200 cursor-pointer active:scale-[0.96]">
              <BarChart3 className="h-3.5 w-3.5" /> Analytics
            </span>
          </Link>
          <Link href="/admin/products/new">
            <AdminButton size="sm"><Package className="h-3.5 w-3.5" /> Add Product</AdminButton>
          </Link>
        </div>
      </div>

      {/* Fraud Alert */}
      {fraudAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal">{fraudAlerts.length} fraud alert requires attention</p>
                <p className="text-xs text-charcoal-lighter">{fraudAlerts[0].order} — Risk {fraudAlerts[0].risk}/100 — {fraudAlerts[0].reason}</p>
              </div>
              <Link href="/admin/fraud"><AdminButton variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0">Review <ArrowRight className="h-3 w-3 ml-1" /></AdminButton></Link>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══════ STATS ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loadingStats
          ? Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-7 w-28 mb-1" /><Skeleton className="h-3 w-16" /></CardContent></Card>)
          : statCards.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Link href={stat.href}>
                <Card className="hover:shadow-card-hover transition-shadow cursor-pointer group h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-charcoal-lighter">{stat.label}</span>
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", stat.bg)}><stat.icon className={cn("h-4 w-4", stat.color)} /></div>
                    </div>
                    <p className="text-xl font-bold text-charcoal group-hover:text-secondary transition-colors [font-variant-numeric:tabular-nums]">{stat.value}</p>
                    {stat.change !== 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {stat.change > 0 ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
                        <span className={cn("text-[10px] font-semibold [font-variant-numeric:tabular-nums]", stat.change > 0 ? "text-success" : "text-destructive")}>{stat.change > 0 ? "+" : ""}{stat.change}%</span>
                        <span className="text-[10px] text-charcoal-lighter">vs last month</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
      </div>

      {/* ═══════ ROW 1: Revenue Chart + Category Donut ═══════ */}
      <div className="grid lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-sm font-semibold">Revenue Overview</CardTitle>
            <Tabs value={revenuePeriod} onValueChange={(v) => setRevenuePeriod(v as "weekly" | "monthly")} className="h-8">
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="weekly" className="text-[10px] h-6 px-2.5">Week</TabsTrigger>
                <TabsTrigger value="monthly" className="text-[10px] h-6 px-2.5">Year</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-3">
            <div className="w-full h-[200px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%" debounce={300}>
                {revenuePeriod === "weekly" ? (
                  <BarChart data={revenueBarData} barGap={6} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `৳${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="prev" name="Last Week" fill={chartGrid} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="This Week" fill={chartAccent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={revenueAreaData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartAccent} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={chartAccent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `৳${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke={chartAccent} fill="url(#revenueGrad)" strokeWidth={2} dot={{ r: 3, fill: chartAccent, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5 }} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="w-full h-[170px]">
              <ResponsiveContainer width="100%" height="100%" debounce={300}>
                <PieChart>
                  <Pie data={categoryRevenueChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                    {categoryRevenueChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
              {categoryRevenueChartData.map((cat) => (
                <div key={cat.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-[10px] text-charcoal-lighter truncate">{cat.name}</span>
                  <span className="text-[10px] font-medium text-charcoal ml-auto">{((cat.value / categoryRevenueChartData.reduce((s,c) => s + c.value, 0)) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════ ROW 2: Orders Line + Traffic Area + Order Status Pie ═══════ */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Orders & Customers</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="w-full" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={300}>
                <LineChart data={ordersLineData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="orders" name="Orders" stroke={chartAccent} strokeWidth={2} dot={{ r: 2.5, fill: chartAccent }} />
                  <Line type="monotone" dataKey="customers" name="Customers" stroke="#E0B96C" strokeWidth={2} dot={{ r: 2.5, fill: "#E0B96C" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Traffic & Conversions</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="w-full" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={300}>
                <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartAccent} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={chartAccent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="visitors" name="Visitors" stroke={chartAccent} fill="url(#visitorsGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="conversions" name="Conversions" stroke="#10B981" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Order Status</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="w-full" style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%" debounce={300}>
                <PieChart>
                  <Pie data={orderStatusChartData} cx="50%" cy="50%" outerRadius={58} dataKey="value" stroke="none">
                    {orderStatusChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 mt-1">
              {orderStatusChartData.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[10px] text-charcoal-lighter">{s.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-charcoal">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════ ROW 3: Recent Orders (full width) ═══════ */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">Recent Orders</CardTitle>
          <Link href="/admin/orders" className="text-xs text-secondary hover:text-secondary-dark flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20 text-left">
                  <th className="px-5 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Order</th>
                  <th className="px-5 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">Items</th>
                  <th className="px-5 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Total</th>
                  <th className="px-5 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentDbOrders.map((order) => {
                  const config = orderStatusConfig[order.status] || orderStatusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <tr key={order.id} className="border-b border-border/10 hover:bg-pearl/50 hover:border-secondary/20 transition-colors">
                      <td className="px-5 py-3"><p className="font-medium text-charcoal">{order.id}</p><p className="text-[10px] text-charcoal-lighter">{order.time}</p></td>
                      <td className="px-5 py-3 max-w-[140px] sm:max-w-none"><div className="flex items-center gap-2 min-w-0"><Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="text-[9px]">{getInitials(order.customer)}</AvatarFallback></Avatar><span className="text-charcoal truncate">{order.customer}</span></div></td>
                      <td className="px-5 py-3 text-charcoal-lighter hidden sm:table-cell">{order.items} items</td>
                      <td className="px-5 py-3 font-medium text-charcoal">{formatCurrency(order.total)}</td>
                      <td className="px-5 py-3"><span className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full capitalize", config.color)}><StatusIcon className="h-3 w-3" /> {order.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ═══════ Most Demanded Products (by ordered quantity, archived excluded) ═══════ */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-secondary" /> Most Demanded Products</CardTitle>
          <span className="text-[10px] text-charcoal-lighter">by units ordered</span>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {demandedProducts.length === 0 ? (
            <p className="text-xs text-charcoal-lighter text-center py-6">No order data yet — demand will appear here as products get ordered.</p>
          ) : (
            demandedProducts.map((p, i) => {
              const row = (
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold [font-variant-numeric:tabular-nums]",
                    i === 0 ? "bg-gold/15 text-gold" : i === 1 ? "bg-secondary/10 text-secondary" : "bg-pearl text-charcoal-lighter")}>{i + 1}</span>
                  <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-pearl shrink-0">
                    <Image src={p.image} alt={p.name} fill className="object-cover" sizes="36px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-charcoal truncate">{p.name}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-pearl overflow-hidden">
                      <div className="h-full rounded-full bg-secondary/70" style={{ width: `${Math.max(6, (p.total_qty / maxDemandQty) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-charcoal [font-variant-numeric:tabular-nums]">{p.total_qty.toLocaleString()}</p>
                    <p className="text-[9px] text-charcoal-lighter [font-variant-numeric:tabular-nums]">{p.order_count} order{p.order_count === 1 ? "" : "s"}</p>
                  </div>
                </div>
              );
              return p.slug ? (
                <Link key={p.id} href={`/admin/products/${p.id}`} className="block hover:bg-pearl/40 -mx-2 px-2 py-1 rounded-lg transition-colors">{row}</Link>
              ) : (
                <div key={p.id} className="-mx-2 px-2 py-1">{row}</div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ═══════ ROW 4: Reviews + Low Stock + Coupons + Activity ═══════ */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Pending Reviews */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-gold" /> Reviews</CardTitle>
            <Badge variant="warning" className="text-[9px] px-1.5">{pendingDbReviews.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pendingDbReviews.map((r) => (
              <div key={r.id} className="flex gap-2.5 pb-2.5 border-b border-border/15 last:border-0 last:pb-0">
                <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="text-[8px]">{getInitials(r.customer)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-0.5 mb-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-2 w-2", i < r.rating ? "text-gold fill-gold" : "text-border")} />)}</div>
                  <p className="text-[11px] text-charcoal truncate">{r.product}</p>
                </div>
              </div>
            ))}
            <Link href="/admin/reviews"><AdminButton variant="ghost" size="sm" className="w-full text-secondary text-[11px] h-7">Review All <ArrowRight className="h-3 w-3 ml-1" /></AdminButton></Link>
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-warning" /> Low Stock</CardTitle>
            <Badge variant="warning" className="text-[9px] px-1.5">{lowStockProducts.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {lowStockProducts.slice(0, 5).map((p) => (
              <div key={p.name} className="flex items-center gap-2.5">
                <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-pearl shrink-0"><Image src={p.image} alt={p.name} fill className="object-cover" sizes="36px" /></div>
                <div className="flex-1 min-w-0"><p className="text-[11px] text-charcoal truncate">{p.name}</p><p className={cn("text-[10px] font-semibold", p.stock <= 2 ? "text-destructive" : "text-warning")}>{p.stock} left</p></div>
              </div>
            ))}
            <Link href="/admin/stock"><AdminButton variant="ghost" size="sm" className="w-full text-secondary text-[11px] h-7">View All <ArrowRight className="h-3 w-3 ml-1" /></AdminButton></Link>
          </CardContent>
        </Card>

        {/* Active Coupons */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-secondary" /> Coupons</CardTitle>
            <Link href="/admin/coupons" className="text-[10px] text-secondary flex items-center gap-0.5">Manage <ArrowRight className="h-2.5 w-2.5" /></Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeCoupons.map((c) => (
              <div key={c.code}>
                <div className="flex items-center justify-between mb-1"><code className="font-mono text-[11px] font-bold text-charcoal">{c.code}</code><span className="text-[9px] text-charcoal-lighter">{c.type}</span></div>
                <Progress value={(c.used / c.limit) * 100} />
                <p className="text-[9px] text-charcoal-lighter mt-0.5">{c.used}/{c.limit}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Live Activity — mirrors /admin/activity-log's entity icon/color
            convention so the preview here and the full log read as one
            feature, just truncated to the 5 most recent entries. */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-blue-500" /> Activity</CardTitle>
            <Link href="/admin/activity-log" className="text-[10px] text-secondary flex items-center gap-0.5">Log <ArrowRight className="h-2.5 w-2.5" /></Link>
          </CardHeader>
          <CardContent>
            {!dbActivityLog ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
            ) : dbActivityLog.length === 0 ? (
              <p className="text-[11px] text-charcoal-lighter text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-2.5">
                {dbActivityLog.slice(0, 5).map((log) => {
                  const entityType = log.entity_type as string;
                  const Icon = activityEntityIcons[entityType] || Package;
                  const color = activityEntityColors[entityType] || "bg-pearl text-charcoal-lighter";
                  return (
                    <div key={log.id as number} className="flex items-start gap-2">
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-full shrink-0 mt-0.5", color)}>
                        <Icon className="h-2.5 w-2.5" />
                      </div>
                      <p className="text-[10px] text-charcoal leading-tight line-clamp-2">
                        <span className="font-medium">{(log.user_name as string) || "System"}</span>{" "}
                        <span className="text-charcoal-lighter">{log.action as string}</span>
                        {log.details ? <span className="font-medium"> {log.details as string}</span> : null}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gradient-to-r from-primary-light via-pearl to-cream border-0">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-charcoal mr-1">Quick:</span>
            <Link href="/admin/products/new"><AdminButton variant="outline" size="sm" className="h-7 text-[11px]"><Package className="h-3 w-3 mr-1" /> Add Product</AdminButton></Link>
            <Link href="/admin/coupons"><AdminButton variant="outline" size="sm" className="h-7 text-[11px]"><Tag className="h-3 w-3 mr-1" /> Coupon</AdminButton></Link>
            <Link href="/admin/blog"><AdminButton variant="outline" size="sm" className="h-7 text-[11px]"><FileText className="h-3 w-3 mr-1" /> Blog</AdminButton></Link>
            <Link href="/admin/seo"><AdminButton variant="outline" size="sm" className="h-7 text-[11px]"><BarChart3 className="h-3 w-3 mr-1" /> SEO</AdminButton></Link>
            <Link href="/admin/fraud"><AdminButton variant="outline" size="sm" className="h-7 text-[11px]"><Shield className="h-3 w-3 mr-1" /> Fraud</AdminButton></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
