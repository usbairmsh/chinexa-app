import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// GET /api/accounting?year=2026 — financial overview derived from real orders/returns
export async function GET(req: NextRequest) {
  try {
    const yearParam = Number(req.nextUrl.searchParams.get("year"));
    const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();

    // Available years for the selector
    const yearRows = await query<RowDataPacket[]>(
      "SELECT DISTINCT YEAR(created_at) AS y FROM orders ORDER BY y DESC"
    );
    const years = yearRows.map((r) => Number(r.y)).filter((y) => Number.isFinite(y));

    // Monthly revenue + order counts (exclude cancelled orders)
    const revRows = await query<RowDataPacket[]>(
      `SELECT MONTH(created_at) AS m, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
       FROM orders WHERE YEAR(created_at) = ? AND status <> 'cancelled'
       GROUP BY MONTH(created_at)`,
      [year]
    );

    // Monthly refunds (approved/refunded returns) count as expenses
    const refundRows = await query<RowDataPacket[]>(
      `SELECT MONTH(updated_at) AS m, COALESCE(SUM(refund_amount), 0) AS refunds
       FROM order_returns WHERE status IN ('refunded', 'approved') AND YEAR(updated_at) = ?
       GROUP BY MONTH(updated_at)`,
      [year]
    ).catch(() => [] as RowDataPacket[]);

    const revByMonth = new Map(revRows.map((r) => [Number(r.m), r]));
    const refByMonth = new Map(refundRows.map((r) => [Number(r.m), Number(r.refunds) || 0]));

    const monthly = MONTH_NAMES.map((name, i) => {
      const rev = revByMonth.get(i + 1);
      return {
        month: name,
        revenue: rev ? Number(rev.revenue) || 0 : 0,
        refunds: refByMonth.get(i + 1) || 0,
        orders: rev ? Number(rev.orders) || 0 : 0,
      };
    });

    const totalRevenue = monthly.reduce((s, m) => s + m.revenue, 0);
    const totalRefunds = monthly.reduce((s, m) => s + m.refunds, 0);
    const totalOrders = monthly.reduce((s, m) => s + m.orders, 0);

    // Recent transactions: orders (income) + refunded returns (refunds)
    const orderTxns = await query<RowDataPacket[]>(
      `SELECT id, order_number, customer_name, total, payment_method, created_at
       FROM orders WHERE status <> 'cancelled' ORDER BY created_at DESC LIMIT 15`
    );
    const refundTxns = await query<RowDataPacket[]>(
      `SELECT r.id, r.order_id, r.refund_amount, r.updated_at, o.order_number
       FROM order_returns r LEFT JOIN orders o ON o.id = r.order_id
       WHERE r.status IN ('refunded', 'approved') AND r.refund_amount IS NOT NULL
       ORDER BY r.updated_at DESC LIMIT 10`
    ).catch(() => [] as RowDataPacket[]);

    const transactions = [
      ...orderTxns.map((o) => ({
        id: `ord-${o.id}`,
        type: "income" as const,
        description: `Order #${o.order_number}${o.customer_name ? ` — ${o.customer_name}` : ""}`,
        amount: Number(o.total) || 0,
        method: (o.payment_method as string) || "—",
        date: o.created_at,
      })),
      ...refundTxns.map((r) => ({
        id: `ref-${r.id}`,
        type: "refund" as const,
        description: `Refund — Order #${r.order_number || r.order_id}`,
        amount: -(Number(r.refund_amount) || 0),
        method: "Refund",
        date: r.updated_at,
      })),
    ]
      .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime())
      .slice(0, 20);

    return NextResponse.json({
      year,
      years: years.length > 0 ? years : [year],
      summary: {
        total_revenue: totalRevenue,
        total_refunds: totalRefunds,
        net: totalRevenue - totalRefunds,
        total_orders: totalOrders,
      },
      monthly,
      transactions,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
