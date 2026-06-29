import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

interface CountRow extends RowDataPacket { count: number; }
interface SumRow extends RowDataPacket { total: number; }
interface StatusRow extends RowDataPacket { status: string; count: number; }
interface CategoryRow extends RowDataPacket { category_name: string; revenue: number; }
interface PaymentRow extends RowDataPacket { payment_method: string; count: number; amount: number; }

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Stats
    const [totalProducts] = await query<CountRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1");
    const [totalCustomers] = await query<CountRow[]>("SELECT COUNT(*) as count FROM customers");
    const [totalOrders] = await query<CountRow[]>("SELECT COUNT(*) as count FROM orders");
    const [revenueResult] = await query<SumRow[]>("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status = 'received' AND payment_status = 'paid'");
    const [pendingOrders] = await query<CountRow[]>("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
    const [pendingReviews] = await query<CountRow[]>("SELECT COUNT(*) as count FROM reviews WHERE is_approved = 0");

    const totalRevenue = Number(revenueResult?.total || 0);
    const orderCount = totalOrders?.count || 0;
    const paidOrders = await query<CountRow[]>("SELECT COUNT(*) as count FROM orders WHERE status = 'received' AND payment_status = 'paid'");
    const avgOrderValue = paidOrders[0]?.count > 0 ? Math.round(totalRevenue / paidOrders[0].count) : 0;

    // Order status distribution
    const orderStatuses = await query<StatusRow[]>("SELECT status, COUNT(*) as count FROM orders GROUP BY status");

    // Revenue by category
    const categoryRevenue = await query<CategoryRow[]>(`
      SELECT p.category_name, COALESCE(SUM(oi.total_price), 0) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'received' AND payment_status = 'paid'
      GROUP BY p.category_name
      ORDER BY revenue DESC
    `);

    // Payment method distribution
    const paymentMethods = await query<PaymentRow[]>(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as amount
      FROM orders WHERE status = 'received' AND payment_status = 'paid'
      GROUP BY payment_method ORDER BY amount DESC
    `);

    // Recent 30 days vs previous 30 days for change %
    const [recent30] = await query<SumRow[]>("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status = 'received' AND payment_status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const [prev30] = await query<SumRow[]>("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status = 'received' AND payment_status = 'paid' AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const revenueChange = Number(prev30?.total) > 0 ? Math.round(((Number(recent30?.total) - Number(prev30?.total)) / Number(prev30?.total)) * 100 * 10) / 10 : 0;

    const [recentOrders30] = await query<CountRow[]>("SELECT COUNT(*) as count FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const [prevOrders30] = await query<CountRow[]>("SELECT COUNT(*) as count FROM orders WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const ordersChange = prevOrders30?.count > 0 ? Math.round(((recentOrders30?.count - prevOrders30?.count) / prevOrders30?.count) * 100 * 10) / 10 : 0;

    const [recentCustomers] = await query<CountRow[]>("SELECT COUNT(*) as count FROM customers WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const [prevCustomers] = await query<CountRow[]>("SELECT COUNT(*) as count FROM customers WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const customersChange = prevCustomers?.count > 0 ? Math.round(((recentCustomers?.count - prevCustomers?.count) / prevCustomers?.count) * 100 * 10) / 10 : 0;

    return NextResponse.json({
      stats: {
        total_revenue: totalRevenue,
        total_orders: orderCount,
        total_customers: totalCustomers?.count || 0,
        total_products: totalProducts?.count || 0,
        average_order_value: avgOrderValue,
        pending_orders: pendingOrders?.count || 0,
        pending_reviews: pendingReviews?.count || 0,
        revenue_change: revenueChange,
        orders_change: ordersChange,
        customers_change: customersChange,
      },
      order_statuses: orderStatuses.map((s) => ({ name: s.status, value: s.count })),
      category_revenue: categoryRevenue.map((c) => ({ name: c.category_name || "Other", value: Number(c.revenue) })),
      payment_methods: paymentMethods.map((p) => ({ method: p.payment_method, orders: p.count, amount: Number(p.amount) })),
      computed_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
