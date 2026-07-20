import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureOrderArchiveColumns } from "@/lib/migrate-order-archive";

interface CountRow extends RowDataPacket { count: number; }
interface SumRow extends RowDataPacket { total: number; }
interface StatusRow extends RowDataPacket { status: string; count: number; }
interface CategoryRow extends RowDataPacket { category_name: string; revenue: number; }
interface PaymentRow extends RowDataPacket { payment_method: string; count: number; amount: number; }

export const dynamic = "force-dynamic";

interface RevenueRow extends RowDataPacket { total: number; order_count: number; }
interface PaidWindowRow extends RowDataPacket { recent_total: number; prev_total: number; recent_count: number; prev_count: number; }
interface CustomerWindowRow extends RowDataPacket { recent_count: number; prev_count: number; }

export async function GET() {
  try {
    await ensureOrderArchiveColumns();
    // All independent — none depend on another's result — so they run as one
    // round-trip batch instead of the ~16 sequential ones this route used to issue.
    const [
      [totalProducts],
      [totalCustomers],
      [totalOrders],
      [revenueResult],
      [pendingOrders],
      [pendingReviews],
      orderStatuses,
      categoryRevenue,
      paymentMethods,
      [paidWindow],
      [customerWindow],
    ] = await Promise.all([
      query<CountRow[]>("SELECT COUNT(*) as count FROM products WHERE is_active = 1"),
      query<CountRow[]>("SELECT COUNT(*) as count FROM customers"),
      // Archived orders are excluded from every admin-facing count/total —
      // they're set to 'cancelled' and reversed on archive (see PUT /api/orders/[id]),
      // but is_archived = 0 here specifically drops them from "Total Orders"
      // too, distinct from a genuine (non-archived) cancellation, which should
      // still count as a real order that was once placed.
      query<CountRow[]>("SELECT COUNT(*) as count FROM orders WHERE is_archived = 0"),
      // SUM(total) and COUNT(*) share the same predicate — one query, not two.
      query<RevenueRow[]>("SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as order_count FROM orders WHERE status = 'received' AND payment_status = 'paid' AND is_archived = 0"),
      query<CountRow[]>("SELECT COUNT(*) as count FROM orders WHERE status = 'pending' AND is_archived = 0"),
      query<CountRow[]>("SELECT COUNT(*) as count FROM reviews WHERE is_approved = 0"),
      query<StatusRow[]>("SELECT status, COUNT(*) as count FROM orders WHERE is_archived = 0 GROUP BY status"),
      query<CategoryRow[]>(`
        SELECT p.category_name, COALESCE(SUM(oi.total_price), 0) as revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'received' AND payment_status = 'paid'
        GROUP BY p.category_name
        ORDER BY revenue DESC
      `),
      query<PaymentRow[]>(`
        SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as amount
        FROM orders WHERE status = 'received' AND payment_status = 'paid'
        GROUP BY payment_method ORDER BY amount DESC
      `),
      // Recent 30 days vs previous 30 days, collapsed into one conditional-
      // aggregation query instead of 2 separate full scans.
      query<PaidWindowRow[]>(`
        SELECT
          COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN total ELSE 0 END), 0) as recent_total,
          COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN total ELSE 0 END), 0) as prev_total,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_count,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as prev_count
        FROM orders WHERE status = 'received' AND payment_status = 'paid'
      `),
      query<CustomerWindowRow[]>(`
        SELECT
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_count,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as prev_count
        FROM customers
      `),
    ]);

    const totalRevenue = Number(revenueResult?.total || 0);
    const orderCount = totalOrders?.count || 0;
    const paidOrderCount = Number(revenueResult?.order_count || 0);
    const avgOrderValue = paidOrderCount > 0 ? Math.round(totalRevenue / paidOrderCount) : 0;

    const revenueChange = Number(paidWindow?.prev_total) > 0
      ? Math.round(((Number(paidWindow?.recent_total) - Number(paidWindow?.prev_total)) / Number(paidWindow?.prev_total)) * 100 * 10) / 10
      : 0;
    const ordersChange = Number(paidWindow?.prev_count) > 0
      ? Math.round(((Number(paidWindow?.recent_count) - Number(paidWindow?.prev_count)) / Number(paidWindow?.prev_count)) * 100 * 10) / 10
      : 0;
    const customersChange = Number(customerWindow?.prev_count) > 0
      ? Math.round(((Number(customerWindow?.recent_count) - Number(customerWindow?.prev_count)) / Number(customerWindow?.prev_count)) * 100 * 10) / 10
      : 0;

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
