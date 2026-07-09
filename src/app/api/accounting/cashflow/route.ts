import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureAccountingTables } from "@/lib/migrate-accounting";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface PeriodFlow {
  orders: number;
  investments: number;
  loanDisbursements: number;
  expenses: number;
  withdrawals: number;
  loanPayments: number;
  refunds: number;
}

/** Sum cash in/out across all real tables for rows strictly before `beforeDate` (YYYY-MM-DD). */
async function cashFlowBefore(beforeDate: string): Promise<PeriodFlow> {
  const [ordersRows, investRows, loanDisbRows, expenseRows, withdrawRows, loanPayRows, refundRows] = await Promise.all([
    query<RowDataPacket[]>("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE payment_status = 'paid' AND created_at < ?", [beforeDate]),
    query<RowDataPacket[]>("SELECT COALESCE(SUM(amount),0) AS v FROM partner_transactions WHERE type = 'investment' AND transaction_date < ?", [beforeDate]),
    query<RowDataPacket[]>("SELECT COALESCE(SUM(principal),0) AS v FROM loans WHERE start_date < ?", [beforeDate]).catch(() => [{ v: 0 }] as unknown as RowDataPacket[]),
    query<RowDataPacket[]>("SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE expense_date < ?", [beforeDate]),
    query<RowDataPacket[]>("SELECT COALESCE(SUM(amount),0) AS v FROM partner_transactions WHERE type IN ('withdrawal','profit_distribution') AND transaction_date < ?", [beforeDate]),
    query<RowDataPacket[]>("SELECT COALESCE(SUM(amount),0) AS v FROM loan_repayments WHERE repayment_date < ?", [beforeDate]).catch(() => [{ v: 0 }] as unknown as RowDataPacket[]),
    query<RowDataPacket[]>("SELECT COALESCE(SUM(refund_amount),0) AS v FROM order_returns WHERE status IN ('refunded','approved') AND updated_at < ?", [beforeDate]).catch(() => [{ v: 0 }] as unknown as RowDataPacket[]),
  ]);
  return {
    orders: Number(ordersRows[0]?.v) || 0,
    investments: Number(investRows[0]?.v) || 0,
    loanDisbursements: Number(loanDisbRows[0]?.v) || 0,
    expenses: Number(expenseRows[0]?.v) || 0,
    withdrawals: Number(withdrawRows[0]?.v) || 0,
    loanPayments: Number(loanPayRows[0]?.v) || 0,
    refunds: Number(refundRows[0]?.v) || 0,
  };
}

// GET /api/accounting/cashflow?year=2026&month=7 — cash in/out derived live from orders/expenses/partner_transactions/loans/returns
export async function GET(req: NextRequest) {
  try {
    await ensureAccountingTables();
    const { searchParams } = new URL(req.url);
    const yearParam = Number(searchParams.get("year"));
    const year = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : new Date().getFullYear();
    const monthParam = searchParams.get("month");
    const month = monthParam ? Number(monthParam) : null;

    const periodStart = month ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-01-01`;
    const opening = await cashFlowBefore(periodStart);
    const openingBalance = opening.orders + opening.investments + opening.loanDisbursements
      - opening.expenses - opening.withdrawals - opening.loanPayments - opening.refunds;

    // Monthly breakdown across the whole year (used for both the single-month
    // and whole-year views — the frontend can select the one row it needs)
    const [ordersByMonth, investByMonth, loanDisbByMonth, expenseByMonth, withdrawByMonth, loanPayByMonth, refundByMonth] = await Promise.all([
      query<RowDataPacket[]>("SELECT MONTH(created_at) AS m, COALESCE(SUM(total),0) AS v FROM orders WHERE payment_status = 'paid' AND YEAR(created_at) = ? GROUP BY MONTH(created_at)", [year]),
      query<RowDataPacket[]>("SELECT MONTH(transaction_date) AS m, COALESCE(SUM(amount),0) AS v FROM partner_transactions WHERE type = 'investment' AND YEAR(transaction_date) = ? GROUP BY MONTH(transaction_date)", [year]),
      query<RowDataPacket[]>("SELECT MONTH(start_date) AS m, COALESCE(SUM(principal),0) AS v FROM loans WHERE YEAR(start_date) = ? GROUP BY MONTH(start_date)", [year]).catch(() => [] as RowDataPacket[]),
      query<RowDataPacket[]>("SELECT MONTH(expense_date) AS m, COALESCE(SUM(amount),0) AS v FROM expenses WHERE YEAR(expense_date) = ? GROUP BY MONTH(expense_date)", [year]),
      query<RowDataPacket[]>("SELECT MONTH(transaction_date) AS m, COALESCE(SUM(amount),0) AS v FROM partner_transactions WHERE type IN ('withdrawal','profit_distribution') AND YEAR(transaction_date) = ? GROUP BY MONTH(transaction_date)", [year]),
      query<RowDataPacket[]>("SELECT MONTH(repayment_date) AS m, COALESCE(SUM(amount),0) AS v FROM loan_repayments WHERE YEAR(repayment_date) = ? GROUP BY MONTH(repayment_date)", [year]).catch(() => [] as RowDataPacket[]),
      query<RowDataPacket[]>("SELECT MONTH(updated_at) AS m, COALESCE(SUM(refund_amount),0) AS v FROM order_returns WHERE status IN ('refunded','approved') AND YEAR(updated_at) = ? GROUP BY MONTH(updated_at)", [year]).catch(() => [] as RowDataPacket[]),
    ]);

    const mapOf = (rows: RowDataPacket[]) => new Map(rows.map((r) => [Number(r.m), Number(r.v) || 0]));
    const ordersMap = mapOf(ordersByMonth);
    const investMap = mapOf(investByMonth);
    const loanDisbMap = mapOf(loanDisbByMonth);
    const expenseMap = mapOf(expenseByMonth);
    const withdrawMap = mapOf(withdrawByMonth);
    const loanPayMap = mapOf(loanPayByMonth);
    const refundMap = mapOf(refundByMonth);

    let runningBalance = openingBalance;
    const monthly = MONTH_NAMES.map((name, i) => {
      const cashIn = (ordersMap.get(i + 1) || 0) + (investMap.get(i + 1) || 0) + (loanDisbMap.get(i + 1) || 0);
      const cashOut = (expenseMap.get(i + 1) || 0) + (withdrawMap.get(i + 1) || 0) + (loanPayMap.get(i + 1) || 0) + (refundMap.get(i + 1) || 0);
      const opening_balance = runningBalance;
      runningBalance += cashIn - cashOut;
      return { month: name, cash_in: cashIn, cash_out: cashOut, opening_balance, closing_balance: runningBalance, net: cashIn - cashOut };
    });

    const scoped = month ? [monthly[month - 1]] : monthly;
    const periodCashIn = scoped.reduce((s, m) => s + m.cash_in, 0);
    const periodCashOut = scoped.reduce((s, m) => s + m.cash_out, 0);
    const closingBalance = month ? monthly[month - 1].closing_balance : runningBalance;

    return NextResponse.json({
      year, month,
      opening_balance: openingBalance,
      cash_in: {
        orders: month ? ordersMap.get(month) || 0 : Array.from(ordersMap.values()).reduce((s, v) => s + v, 0),
        investments: month ? investMap.get(month) || 0 : Array.from(investMap.values()).reduce((s, v) => s + v, 0),
        loan_disbursements: month ? loanDisbMap.get(month) || 0 : Array.from(loanDisbMap.values()).reduce((s, v) => s + v, 0),
        total: periodCashIn,
      },
      cash_out: {
        expenses: month ? expenseMap.get(month) || 0 : Array.from(expenseMap.values()).reduce((s, v) => s + v, 0),
        withdrawals: month ? withdrawMap.get(month) || 0 : Array.from(withdrawMap.values()).reduce((s, v) => s + v, 0),
        loan_payments: month ? loanPayMap.get(month) || 0 : Array.from(loanPayMap.values()).reduce((s, v) => s + v, 0),
        refunds: month ? refundMap.get(month) || 0 : Array.from(refundMap.values()).reduce((s, v) => s + v, 0),
        total: periodCashOut,
      },
      closing_balance: closingBalance,
      monthly,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
