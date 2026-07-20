"use client";

import { useState } from "react";
import { TrendingUp, ShoppingCart, Users, Package, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useRevenueChartData, useOrdersChartData, useTrafficData, useTopProductsData,
  useLowStockProducts, useAdminDashboardStats,
} from "@/hooks/queries/use-admin-data";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const tooltipStyle = { borderRadius: "12px", border: "1px solid #F3DFEC", fontSize: "12px", boxShadow: "0 4px 30px rgba(0,0,0,0.04)" };
const chartGrid = "#F3DFEC";
const chartAxisLabel = "#8A7590";
const chartAccent = "#7A4FA0";
const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#7A4FA0", processing: "#60A5FA", shipped: "#3B82F6",
  on_delivery: "#8B5CF6", received: "#10B981", not_received: "#EF4444", returned: "#F97316", cancelled: "#6B7280",
};

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const { data: stats, isLoading: loadingStats } = useAdminDashboardStats();
  const { data: revenueData, isLoading: loadingRevenue } = useRevenueChartData(period);
  const { data: ordersData, isLoading: loadingOrders } = useOrdersChartData(period);
  const { data: trafficData, isLoading: loadingTraffic } = useTrafficData();
  const { data: topProducts, isLoading: loadingTop } = useTopProductsData(5);
  const { data: lowStock, isLoading: loadingLowStock } = useLowStockProducts();

  const orderStatusData = (stats?.order_statuses || []).map((s) => ({ ...s, color: STATUS_COLORS[s.name] || chartAxisLabel }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Analytics</h1>
          <p className="text-sm text-charcoal-lighter">Track your store performance</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="1y">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ─── Summary cards ─── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-charcoal-lighter">Total Revenue</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10"><TrendingUp className="h-4 w-4 text-success" /></div>
            </div>
            {loadingStats ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(stats?.stats.total_revenue || 0)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-charcoal-lighter">Total Orders</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10"><ShoppingCart className="h-4 w-4 text-secondary" /></div>
            </div>
            {loadingStats ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{stats?.stats.total_orders || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-charcoal-lighter">Total Customers</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100"><Users className="h-4 w-4 text-charcoal" /></div>
            </div>
            {loadingStats ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{stats?.stats.total_customers || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-charcoal-lighter">Avg Order Value</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10"><Package className="h-4 w-4 text-gold" /></div>
            </div>
            {loadingStats ? <Skeleton className="h-7 w-24" /> : <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(stats?.stats.average_order_value || 0)}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue</CardTitle></CardHeader>
          <CardContent>
            {loadingRevenue ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="w-full" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={300}>
                  <AreaChart data={revenueData || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analyticsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7A4FA0" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#7A4FA0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                    <Area type="monotone" dataKey="value" name="Revenue" stroke="#7A4FA0" fill="url(#analyticsRevenueGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders Chart */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Orders &amp; Customers</CardTitle></CardHeader>
          <CardContent>
            {loadingOrders ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="w-full" style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={300}>
                  <LineChart data={ordersData || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="orders" name="Orders" stroke={chartAccent} strokeWidth={2} dot={{ r: 2.5, fill: chartAccent }} />
                    <Line type="monotone" dataKey="customers" name="Customers" stroke="#60A5FA" strokeWidth={2} dot={{ r: 2.5, fill: "#60A5FA" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Traffic */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Traffic &amp; Conversions</CardTitle></CardHeader>
          <CardContent>
            {loadingTraffic ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="w-full" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={300}>
                  <AreaChart data={trafficData || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analyticsVisitorsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartAccent} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={chartAccent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="visitors" name="Visitors" stroke={chartAccent} fill="url(#analyticsVisitorsGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="conversions" name="Conversions" stroke="#10B981" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Status */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Order Status</CardTitle></CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <>
                <div className="w-full" style={{ height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%" debounce={300}>
                    <PieChart>
                      <Pie data={orderStatusData} cx="50%" cy="50%" outerRadius={58} dataKey="value" stroke="none">
                        {orderStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1 mt-1">
                  {orderStatusData.map((s) => (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-xs text-charcoal-lighter capitalize">{s.name.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-xs font-medium text-charcoal [font-variant-numeric:tabular-nums]">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Top Products</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loadingTop ? (
              <div className="p-5"><Skeleton className="h-40 w-full" /></div>
            ) : !topProducts || topProducts.length === 0 ? (
              <EmptyState icon={Package} title="No sales data yet" description="Top-selling products will appear here once orders come in." className="py-10" />
            ) : (
              <div className="divide-y divide-border/20">
                {topProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-primary-light/30">
                    <span className="text-sm text-charcoal truncate max-w-[180px]">{p.name}</span>
                    <div className="text-right">
                      <p className="text-sm font-medium text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(p.revenue)}</p>
                      <p className="text-xs text-charcoal-lighter [font-variant-numeric:tabular-nums]">{p.total_sold} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Low Stock Alerts</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loadingLowStock ? (
              <div className="p-5"><Skeleton className="h-40 w-full" /></div>
            ) : !lowStock || lowStock.length === 0 ? (
              <EmptyState icon={AlertTriangle} title="No low-stock products" description="Every product is comfortably stocked right now." className="py-10" />
            ) : (
              <div className="divide-y divide-border/20">
                {lowStock.map((p) => (
                  <div key={p.name} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-primary-light/30">
                    <span className="text-sm text-charcoal truncate max-w-[200px]">{p.name}</span>
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive [font-variant-numeric:tabular-nums]">{p.stock} left</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
