"use client";

import { useQuery } from "@tanstack/react-query";
import { services } from "@/services";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => services.analytics.getDashboardStats(),
  });
}

export function useRevenueChart(period: "7d" | "30d" | "90d" | "1y") {
  return useQuery({
    queryKey: ["analytics", "revenue", period],
    queryFn: () => services.analytics.getRevenueChart(period),
  });
}

export function useOrdersChart(period: "7d" | "30d" | "90d" | "1y") {
  return useQuery({
    queryKey: ["analytics", "orders", period],
    queryFn: () => services.analytics.getOrdersChart(period),
  });
}

export function useTopProducts(limit = 5) {
  return useQuery({
    queryKey: ["analytics", "top-products", limit],
    queryFn: () => services.analytics.getTopProducts(limit),
  });
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ["analytics", "recent-activity", limit],
    queryFn: () => services.analytics.getRecentActivity(limit),
  });
}
