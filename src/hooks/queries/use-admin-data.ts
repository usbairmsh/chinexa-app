"use client";

import { useQuery } from "@tanstack/react-query";

const FOUR_HOURS = 4 * 60 * 60 * 1000;

async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── Orders ───
export function useAdminOrders(params?: { status?: string; search?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.search) sp.set("search", params.search);
  if (params?.page) sp.set("page", String(params.page));
  return useQuery({
    queryKey: ["admin-orders", params],
    queryFn: () => fetchApi<{ data: Record<string, unknown>[]; total: number }>(`/api/orders?${sp.toString()}`),
    refetchInterval: FOUR_HOURS,
  });
}

export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => fetchApi<Record<string, unknown>>(`/api/orders/${id}`),
    enabled: !!id,
  });
}

// ─── Customers ───
export function useAdminCustomers(params?: { search?: string; page?: number }) {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.page) sp.set("page", String(params.page));
  return useQuery({
    queryKey: ["admin-customers", params],
    queryFn: () => fetchApi<{ data: Record<string, unknown>[]; total: number }>(`/api/customers?${sp.toString()}`),
    refetchInterval: FOUR_HOURS,
  });
}

export function useAdminCustomer(id: string) {
  return useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => fetchApi<Record<string, unknown>>(`/api/customers/${id}`),
    enabled: !!id,
  });
}

// ─── Reviews ───
export function useAdminReviews(params?: { product_id?: string; is_approved?: string }) {
  const sp = new URLSearchParams();
  if (params?.product_id) sp.set("product_id", params.product_id);
  if (params?.is_approved) sp.set("is_approved", params.is_approved);
  return useQuery({
    queryKey: ["admin-reviews", params],
    queryFn: () => fetchApi<Record<string, unknown>[]>(`/api/reviews?${sp.toString()}`),
    refetchInterval: FOUR_HOURS,
  });
}

// ─── Coupons ───
export function useAdminCoupons() {
  return useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => fetchApi<Record<string, unknown>[]>("/api/coupons"),
    refetchInterval: FOUR_HOURS,
  });
}

// ─── Blog ───
export function useAdminBlogPosts() {
  return useQuery({
    queryKey: ["admin-blog"],
    queryFn: () => fetchApi<Record<string, unknown>[]>("/api/blog?limit=100"),
  });
}

// ─── Dashboard Analytics ───
interface DashboardAnalytics {
  stats: {
    total_revenue: number; total_orders: number; total_customers: number; total_products: number;
    average_order_value: number; pending_orders: number; pending_reviews: number;
    revenue_change: number; orders_change: number; customers_change: number;
  };
  order_statuses: { name: string; value: number }[];
  category_revenue: { name: string; value: number }[];
  payment_methods: { method: string; orders: number; amount: number }[];
  computed_at: string;
}

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ["admin-dashboard-analytics"],
    queryFn: () => fetchApi<DashboardAnalytics>("/api/analytics/dashboard"),
    refetchInterval: FOUR_HOURS,
  });
}

// ─── Revenue Chart ───
export function useRevenueChartData(period: "7d" | "30d" | "90d" | "1y") {
  return useQuery({
    queryKey: ["admin-revenue-chart", period],
    queryFn: () => fetchApi<{ label: string; value: number }[]>(`/api/analytics/revenue?period=${period}`),
    refetchInterval: FOUR_HOURS,
  });
}

// ─── Orders Chart ───
export function useOrdersChartData(period: "7d" | "1y") {
  return useQuery({
    queryKey: ["admin-orders-chart", period],
    queryFn: () => fetchApi<{ label: string; orders: number; customers: number }[]>(`/api/analytics/orders?period=${period}`),
    refetchInterval: FOUR_HOURS,
  });
}

// ─── Top Products ───
export function useTopProductsData(limit = 5) {
  return useQuery({
    queryKey: ["admin-top-products", limit],
    queryFn: () => fetchApi<{ id: string; name: string; total_sold: number; revenue: number; image: string }[]>(`/api/analytics/top-products?limit=${limit}`),
    refetchInterval: FOUR_HOURS,
  });
}

// ─── Traffic & Conversions ───
export function useTrafficData() {
  return useQuery({
    queryKey: ["admin-traffic"],
    queryFn: () => fetchApi<{ day: string; visitors: number; conversions: number }[]>("/api/analytics/traffic"),
    refetchInterval: FOUR_HOURS,
  });
}

// ─── Low Stock Products ───
export function useLowStockProducts() {
  return useQuery({
    queryKey: ["admin-low-stock"],
    queryFn: () => fetchApi<{ name: string; stock: number; image: string }[]>("/api/analytics/low-stock"),
    refetchInterval: FOUR_HOURS,
  });
}

// ─── Activity Log ───
export function useActivityLog(limit = 30) {
  return useQuery({
    queryKey: ["admin-activity-log", limit],
    queryFn: () => fetchApi<Record<string, unknown>[]>(`/api/activity-log?limit=${limit}`),
    refetchInterval: FOUR_HOURS,
  });
}
