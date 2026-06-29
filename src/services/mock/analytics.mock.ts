import type { DashboardStats, ChartDataPoint, TopProduct, RecentActivity } from "@/types/analytics";
import type { IAnalyticsService } from "../interfaces/analytics.interface";
import { delay } from "@/lib/utils";

export class MockAnalyticsService implements IAnalyticsService {
  async getDashboardStats(): Promise<DashboardStats> {
    await delay(300);
    return {
      total_revenue: 4285600,
      total_orders: 527,
      total_customers: 312,
      total_products: 300,
      revenue_change: 12.5,
      orders_change: 8.3,
      customers_change: 15.2,
      average_order_value: 8132,
    };
  }

  async getRevenueChart(period: "7d" | "30d" | "90d" | "1y"): Promise<ChartDataPoint[]> {
    await delay(300);
    const labels = {
      "7d": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      "30d": Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
      "90d": Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`),
      "1y": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    };
    return labels[period].map((label) => ({
      label,
      value: Math.floor(Math.random() * 500000 + 100000),
      previous_value: Math.floor(Math.random() * 450000 + 80000),
    }));
  }

  async getOrdersChart(period: "7d" | "30d" | "90d" | "1y"): Promise<ChartDataPoint[]> {
    await delay(300);
    const labels = {
      "7d": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      "30d": Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
      "90d": Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`),
      "1y": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    };
    return labels[period].map((label) => ({
      label,
      value: Math.floor(Math.random() * 50 + 10),
      previous_value: Math.floor(Math.random() * 45 + 8),
    }));
  }

  async getTopProducts(limit = 5): Promise<TopProduct[]> {
    await delay(200);
    const names = [
      "CosRX Vitamin C Brightening Serum",
      "Laneige Water Sleeping Mask",
      "Aria Leather Tote",
      "Aurora Pendant Necklace",
      "Midnight Rose EDP",
      "Sulwhasoo First Care Activating Serum",
      "Belle Crossbody",
      "Bloom Drop Earrings",
    ];
    return names.slice(0, limit).map((name, i) => ({
      id: `prod-${i + 1}`,
      name,
      image: `https://picsum.photos/seed/top-${i}/100/100`,
      total_sold: Math.floor(Math.random() * 200 + 50),
      revenue: Math.floor(Math.random() * 500000 + 100000),
    }));
  }

  async getRecentActivity(limit = 10): Promise<RecentActivity[]> {
    await delay(200);
    const activities = [
      { type: "order" as const, message: "New order #ORD-0527 placed by Fatima Akter" },
      { type: "customer" as const, message: "New customer Ayesha Rahman registered" },
      { type: "review" as const, message: "New 5-star review on Vitamin C Serum" },
      { type: "product" as const, message: "Product 'Summer Glow Kit' added to pre-orders" },
      { type: "order" as const, message: "Order #ORD-0524 marked as delivered" },
      { type: "customer" as const, message: "Customer Nusrat Jahan updated profile" },
      { type: "review" as const, message: "New 4-star review on Aria Leather Tote" },
      { type: "order" as const, message: "New order #ORD-0526 placed by Sadia Islam" },
      { type: "product" as const, message: "Stock updated for 'Midnight Rose EDP'" },
      { type: "order" as const, message: "Order #ORD-0520 refund processed" },
    ];
    return activities.slice(0, limit).map((a, i) => ({
      id: `activity-${i}`,
      ...a,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
    }));
  }
}
