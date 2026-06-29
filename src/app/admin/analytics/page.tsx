"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenueChart, useOrdersChart } from "@/hooks/queries/use-analytics";
import { formatCurrency } from "@/lib/utils";

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const { data: revenueData, isLoading: loadingRevenue } = useRevenueChart(period);
  const { data: ordersData, isLoading: loadingOrders } = useOrdersChart(period);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Analytics</h1>
          <p className="text-sm text-charcoal-lighter">Track your store performance</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-36">
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRevenue ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-2">
                {revenueData?.slice(0, 10).map((point) => (
                  <div key={point.label} className="flex items-center gap-3">
                    <span className="text-xs text-charcoal-lighter w-12">{point.label}</span>
                    <div className="flex-1 h-6 bg-pearl rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all"
                        style={{ width: `${(point.value / 600000) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-charcoal w-20 text-right">
                      {formatCurrency(point.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-2">
                {ordersData?.slice(0, 10).map((point) => (
                  <div key={point.label} className="flex items-center gap-3">
                    <span className="text-xs text-charcoal-lighter w-12">{point.label}</span>
                    <div className="flex-1 h-6 bg-pearl rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-300 rounded-full transition-all"
                        style={{ width: `${(point.value / 60) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-charcoal w-12 text-right">
                      {point.value}
                    </span>
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
