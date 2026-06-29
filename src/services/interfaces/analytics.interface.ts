import type { DashboardStats, ChartDataPoint, TopProduct, RecentActivity } from "@/types/analytics";

export interface IAnalyticsService {
  getDashboardStats(): Promise<DashboardStats>;
  getRevenueChart(period: "7d" | "30d" | "90d" | "1y"): Promise<ChartDataPoint[]>;
  getOrdersChart(period: "7d" | "30d" | "90d" | "1y"): Promise<ChartDataPoint[]>;
  getTopProducts(limit?: number): Promise<TopProduct[]>;
  getRecentActivity(limit?: number): Promise<RecentActivity[]>;
}
