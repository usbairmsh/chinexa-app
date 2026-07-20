import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureAccountingTables } from "@/lib/migrate-accounting";
import { ensureOrderArchiveColumns } from "@/lib/migrate-order-archive";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Orders whose money the store actually keeps. Reversed orders (cancelled /
// not_received / returned — all three restore stock and reverse revenue in
// PUT /api/orders/[id]) and refunded payments are excluded at the SOURCE, so
// they never inflate sales, COGS or the transactions ledger. is_archived is
// belt-and-braces: archiving sets status='cancelled' nowadays, but rows
// archived before that logic existed only carry the flag. `alias` prefixes
// the columns for queries that join orders under an alias (e.g. "o.").
const keptOrders = (alias = "") =>
  `${alias}status NOT IN ('cancelled','not_received','returned') AND ${alias}payment_status <> 'refunded' AND ${alias}is_archived = 0`;
const KEPT_ORDERS = keptOrders();

// GET /api/accounting?year=2026&source=website|manual|all — financial overview derived from real orders/returns/expenses
export async function GET(req: NextRequest) {
  try {
    await ensureAccountingTables();
    await ensureOrderArchiveColumns();
    const yearParam = Number(req.nextUrl.searchParams.get("year"));
    const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
    const sourceParam = req.nextUrl.searchParams.get("source");
    const source = sourceParam === "website" || sourceParam === "manual" ? sourceParam : "all";
    const sourceFilter = source === "all" ? "" : " AND source = ?";
    const sourceParams = source === "all" ? [] : [source];

    // Years/revenue/refunds are independent of each other — batched.
    const [yearRows, revRows, refundRows] = await Promise.all([
      // Available years for the selector
      query<RowDataPacket[]>("SELECT DISTINCT YEAR(created_at) AS y FROM orders ORDER BY y DESC"),
      // Monthly revenue + order counts — kept orders only (reversed/refunded/
      // archived orders excluded, see KEPT_ORDERS)
      query<RowDataPacket[]>(
        `SELECT MONTH(created_at) AS m, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
         FROM orders WHERE YEAR(created_at) = ? AND ${KEPT_ORDERS}${sourceFilter}
         GROUP BY MONTH(created_at)`,
        [year, ...sourceParams]
      ),
      // Monthly refunds (approved/refunded returns) count as expenses
      query<RowDataPacket[]>(
        `SELECT MONTH(updated_at) AS m, COALESCE(SUM(refund_amount), 0) AS refunds
         FROM order_returns WHERE status IN ('refunded', 'approved') AND YEAR(updated_at) = ?
         GROUP BY MONTH(updated_at)`,
        [year]
      ).catch(() => [] as RowDataPacket[]),
    ]);
    const years = yearRows.map((r) => Number(r.y)).filter((y) => Number.isFinite(y));

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

    // Recent transactions: orders (income) + refunded returns (refunds) — independent, batched.
    const [orderTxns, refundTxns] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT id, order_number, customer_name, total, payment_method, source, created_at
         FROM orders WHERE ${KEPT_ORDERS} ORDER BY created_at DESC LIMIT 15`
      ),
      query<RowDataPacket[]>(
        `SELECT r.id, r.order_id, r.refund_amount, r.updated_at, o.order_number
         FROM order_returns r LEFT JOIN orders o ON o.id = r.order_id
         WHERE r.status IN ('refunded', 'approved') AND r.refund_amount IS NOT NULL
         ORDER BY r.updated_at DESC LIMIT 10`
      ).catch(() => [] as RowDataPacket[]),
    ]);

    const transactions = [
      ...orderTxns.map((o) => ({
        id: `ord-${o.id}`,
        type: "income" as const,
        description: `Order #${o.order_number}${o.customer_name ? ` — ${o.customer_name}` : ""}`,
        amount: Number(o.total) || 0,
        method: (o.payment_method as string) || "—",
        source: (o.source as string) || "website",
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

    // ─── P&L: COGS from order_items cost snapshots, expenses from the expenses table ─── (independent, batched)
    const [cogsRows, expenseRows] = await Promise.all([
      // COGS only for kept orders — returned goods went back into stock, so
      // their cost must not stay on the books either.
      query<RowDataPacket[]>(
        `SELECT MONTH(o.created_at) AS m, COALESCE(SUM(oi.cost_price_snapshot * oi.quantity), 0) AS cogs
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE YEAR(o.created_at) = ? AND ${keptOrders("o.")}${sourceFilter}
         GROUP BY MONTH(o.created_at)`,
        [year, ...sourceParams]
      ),
      query<RowDataPacket[]>(
        `SELECT MONTH(expense_date) AS m, COALESCE(SUM(amount), 0) AS amount
         FROM expenses WHERE YEAR(expense_date) = ? GROUP BY MONTH(expense_date)`,
        [year]
      ),
    ]);
    const cogsByMonth = new Map(cogsRows.map((r) => [Number(r.m), Number(r.cogs) || 0]));
    const expensesByMonth = new Map(expenseRows.map((r) => [Number(r.m), Number(r.amount) || 0]));

    // NOTE: refunds are NOT subtracted here. Reversed/refunded orders are
    // already excluded from revenue and COGS at the source (keptOrders), so
    // also subtracting the order_returns refund amounts would remove the same
    // money twice. The refunds figures stay in the response as an
    // informational "returned to customers" ledger only.
    const pnlMonthly = MONTH_NAMES.map((name, i) => {
      const sales = monthly[i].revenue;
      const cogs = cogsByMonth.get(i + 1) || 0;
      const grossProfit = sales - cogs;
      const expensesAmt = expensesByMonth.get(i + 1) || 0;
      const netProfit = grossProfit - expensesAmt;
      return { month: name, sales, cogs, gross_profit: grossProfit, expenses: expensesAmt, net_profit: netProfit };
    });

    const totalCogs = pnlMonthly.reduce((s, m) => s + m.cogs, 0);
    const totalExpenses = pnlMonthly.reduce((s, m) => s + m.expenses, 0);
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;

    // ─── Expense breakdown by category for the selected year ───
    const breakdownRows = await query<RowDataPacket[]>(
      `SELECT category_name AS category, COALESCE(SUM(amount), 0) AS amount
       FROM expenses WHERE YEAR(expense_date) = ? GROUP BY category_name ORDER BY amount DESC`,
      [year]
    );
    const expenseBreakdown = breakdownRows.map((r) => ({ category: r.category, amount: Number(r.amount) || 0 }));

    // ─── Real Profit: net_profit minus investor profit-share payouts and loan
    // repayments actually recorded this year. Only counts amounts an admin has
    // actually entered as a transaction — never an auto-calculated obligation
    // from a partner's share_percentage. ───
    const [profitShareRows, loanPaymentRows] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT MONTH(transaction_date) AS m, COALESCE(SUM(amount), 0) AS amount
         FROM partner_transactions WHERE type = 'profit_distribution' AND YEAR(transaction_date) = ?
         GROUP BY MONTH(transaction_date)`,
        [year]
      ).catch(() => [] as RowDataPacket[]),
      query<RowDataPacket[]>(
        `SELECT MONTH(repayment_date) AS m, COALESCE(SUM(amount), 0) AS amount
         FROM loan_repayments WHERE YEAR(repayment_date) = ? GROUP BY MONTH(repayment_date)`,
        [year]
      ).catch(() => [] as RowDataPacket[]),
    ]);
    const profitShareByMonth = new Map(profitShareRows.map((r) => [Number(r.m), Number(r.amount) || 0]));
    const loanPaymentByMonth = new Map(loanPaymentRows.map((r) => [Number(r.m), Number(r.amount) || 0]));

    const realProfitMonthly = pnlMonthly.map((m, i) => {
      const profitShare = profitShareByMonth.get(i + 1) || 0;
      const loanPayments = loanPaymentByMonth.get(i + 1) || 0;
      return { month: m.month, real_profit: m.net_profit - profitShare - loanPayments };
    });

    const totalProfitShare = Array.from(profitShareByMonth.values()).reduce((s, v) => s + v, 0);
    const totalLoanPayments = Array.from(loanPaymentByMonth.values()).reduce((s, v) => s + v, 0);
    const realProfit = netProfit - totalProfitShare - totalLoanPayments;

    // ─── Total outstanding liabilities across all active loans — a current
    // snapshot, not year-scoped (liabilities exist independent of the P&L
    // year filter). ───
    // Liability snapshot, all-loans list, and principal-repaid-by-month are
    // mutually independent — batched instead of 3 sequential round-trips.
    const [liabilityRows, allLoans, principalRepaidByLoanMonth] = await Promise.all([
      query<RowDataPacket[]>(
        `SELECT l.id, l.principal, COALESCE(SUM(CASE WHEN lr.type = 'principal' THEN lr.amount ELSE 0 END), 0) AS principal_paid
         FROM loans l LEFT JOIN loan_repayments lr ON lr.loan_id = l.id
         WHERE l.is_active = 1 GROUP BY l.id, l.principal`
      ).catch(() => [] as RowDataPacket[]),
      // ─── Month-end aggregate outstanding liability across all loans that
      // existed by each month of the selected year (Reports-tab trend chart).
      // Computed in JS from small tables, consistent with this file's existing
      // style of JS-side month-bucketing rather than SQL window functions. ───
      query<RowDataPacket[]>("SELECT id, principal, start_date FROM loans").catch(() => [] as RowDataPacket[]),
      query<RowDataPacket[]>(
        `SELECT loan_id, YEAR(repayment_date) AS y, MONTH(repayment_date) AS m, COALESCE(SUM(amount),0) AS v
         FROM loan_repayments WHERE type = 'principal' GROUP BY loan_id, YEAR(repayment_date), MONTH(repayment_date)`
      ).catch(() => [] as RowDataPacket[]),
    ]);
    const totalLiabilities = liabilityRows.reduce((s, r) => s + Math.max(0, (Number(r.principal) || 0) - (Number(r.principal_paid) || 0)), 0);

    const liabilityMonthly = MONTH_NAMES.map((name, i) => {
      const monthIndex = i + 1;
      const cutoff = new Date(year, monthIndex, 0); // last day of this month
      let outstanding = 0;
      for (const loan of allLoans) {
        const startDate = new Date(loan.start_date as string);
        if (startDate > cutoff) continue; // loan didn't exist yet
        const principal = Number(loan.principal) || 0;
        const repaidToDate = principalRepaidByLoanMonth
          .filter((r) => r.loan_id === loan.id && (Number(r.y) < year || (Number(r.y) === year && Number(r.m) <= monthIndex)))
          .reduce((s, r) => s + (Number(r.v) || 0), 0);
        outstanding += Math.max(0, principal - repaidToDate);
      }
      return { month: name, outstanding_liability: outstanding };
    });

    return NextResponse.json({
      year,
      years: years.length > 0 ? years : [year],
      source,
      summary: {
        total_revenue: totalRevenue,
        total_refunds: totalRefunds,
        // Revenue already excludes reversed/refunded orders, so it IS the net
        // figure — subtracting refunds again here would double-count.
        net: totalRevenue,
        total_orders: totalOrders,
      },
      pnl: {
        total_sales: totalRevenue,
        total_cogs: totalCogs,
        gross_profit: grossProfit,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        real_profit: realProfit,
        total_liabilities: totalLiabilities,
      },
      pnl_monthly: pnlMonthly,
      real_profit_monthly: realProfitMonthly,
      liability_monthly: liabilityMonthly,
      expense_breakdown: expenseBreakdown,
      monthly,
      transactions,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
