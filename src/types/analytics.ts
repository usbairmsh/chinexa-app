export interface DashboardStats {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  total_products: number;
  revenue_change: number;
  orders_change: number;
  customers_change: number;
  average_order_value: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  previous_value?: number;
}

export interface TopProduct {
  id: string;
  name: string;
  image: string;
  total_sold: number;
  revenue: number;
}

export interface RecentActivity {
  id: string;
  type: "order" | "customer" | "review" | "product";
  message: string;
  timestamp: string;
  metadata?: Record<string, string>;
}
