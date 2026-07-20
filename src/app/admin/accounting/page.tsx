"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Download, ArrowUpRight, ArrowDownRight, AlertTriangle,
  Plus, Trash2, Pencil, Wallet, Package, Users, PieChart as PieChartIcon, Receipt, ShoppingBag,
  Sparkles, Landmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ExpensesTab } from "@/components/admin/accounting/expenses-tab";
import { ImportBatchesTab } from "@/components/admin/accounting/import-batches-tab";
import { PartnersTab } from "@/components/admin/accounting/partners-tab";
import { LoansTab } from "@/components/admin/accounting/loans-tab";
import { RecordSaleDialog } from "@/components/admin/accounting/record-sale-dialog";
import { useAdmin } from "@/contexts/admin-context";

const tooltipStyle = { borderRadius: "12px", border: "1px solid #F3DFEC", fontSize: "12px", boxShadow: "0 4px 30px rgba(0,0,0,0.04)" };
const chartGrid = "#F3DFEC";
const chartAxisLabel = "#8A7590";
const PIE_COLORS = ["#7A4FA0", "#E0B96C", "#C9AEE6", "#D9668F", "#5C4058", "#F2AFC9"];

interface MonthRow { month: string; revenue: number; refunds: number; orders: number; }
interface PnlMonthRow { month: string; sales: number; cogs: number; gross_profit: number; expenses: number; net_profit: number; }
interface RealProfitMonthRow { month: string; real_profit: number; }
interface LiabilityMonthRow { month: string; outstanding_liability: number; }
interface Txn { id: string; type: "income" | "refund"; description: string; amount: number; method: string; source?: string; date: string; }
interface ExpenseBreakdownRow { category: string; amount: number; }
interface AccountingData {
  year: number;
  years: number[];
  source: "website" | "manual" | "all";
  summary: { total_revenue: number; total_refunds: number; net: number; total_orders: number };
  pnl: { total_sales: number; total_cogs: number; gross_profit: number; total_expenses: number; net_profit: number; real_profit: number; total_liabilities: number };
  pnl_monthly: PnlMonthRow[];
  real_profit_monthly: RealProfitMonthRow[];
  liability_monthly: LiabilityMonthRow[];
  expense_breakdown: ExpenseBreakdownRow[];
  monthly: MonthRow[];
  transactions: Txn[];
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminAccountingPage() {
  const { can } = useAdmin();
  const canAddAccounting = can("accounting", "add");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [sourceFilter, setSourceFilter] = useState<"all" | "website" | "manual">("all");
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordSaleOpen, setRecordSaleOpen] = useState(false);

  const fetchData = useCallback(async (y: number, src: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/accounting?year=${y}&source=${src}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `Failed to load accounting data (${res.status})`);
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Network error — could not load accounting data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(year, sourceFilter); }, [fetchData, year, sourceFilter]);

  // Cash Balance card (Overview) reuses the cashflow endpoint's closing_balance
  // via its own small fetch, same independent-per-tab-fetch pattern CashFlowTab
  // already uses — avoids threading cashflow data through props for one number.
  const [cashBalance, setCashBalance] = useState<number>(0);
  useEffect(() => {
    fetch(`/api/accounting/cashflow?year=${year}`)
      .then((r) => r.json())
      .then((json) => setCashBalance(json.closing_balance || 0))
      .catch(() => setCashBalance(0));
  }, [year]);

  const handleExportTransactions = () => {
    if (!data) return;
    const csv = toCsv(
      ["Type", "Description", "Method", "Source", "Date", "Amount"],
      data.transactions.map((t) => [t.type, t.description, t.method, t.source || "—", formatDate(t.date), t.amount])
    );
    downloadCsv(csv, `accounting-transactions-${data.year}.csv`);
  };

  const handleExportPnl = () => {
    if (!data) return;
    const csv = toCsv(
      ["Month", "Sales", "COGS", "Gross Profit", "Expenses", "Net Profit"],
      data.pnl_monthly.map((m) => [m.month, m.sales, m.cogs, m.gross_profit, m.expenses, m.net_profit])
    );
    downloadCsv(csv, `pnl-summary-${data.year}.csv`);
  };

  const summary = data?.summary;
  const pnl = data?.pnl;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Accounting</h1>
          <p className="text-sm text-charcoal-lighter">Sales, expenses, cost tracking, cash flow & partner equity</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24 sm:w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(data?.years || [year]).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview / P&amp;L</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="import">Import Costs</TabsTrigger>
            <TabsTrigger value="partners">Partners &amp; Equity</TabsTrigger>
            <TabsTrigger value="loans">Loans &amp; Liabilities</TabsTrigger>
            <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* ═══ OVERVIEW / P&L ═══ */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-charcoal-lighter">Total Sales</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
                      <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(pnl?.total_sales || 0)}</p>
                  <p className="text-xs text-charcoal-lighter mt-1">{summary?.total_orders || 0} orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-charcoal-lighter">COGS</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10">
                      <Package className="h-4 w-4 text-warning" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(pnl?.total_cogs || 0)}</p>
                  <p className="text-xs text-charcoal-lighter mt-1">Cost of goods sold</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-charcoal-lighter">Total Expenses</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(pnl?.total_expenses || 0)}</p>
                  <p className="text-xs text-charcoal-lighter mt-1">Ads, delivery, salary, etc.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-charcoal-lighter">Net Profit</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10">
                      <DollarSign className="h-4 w-4 text-secondary" />
                    </div>
                  </div>
                  <p className={cn("text-2xl font-bold [font-variant-numeric:tabular-nums]", (pnl?.net_profit || 0) >= 0 ? "text-charcoal" : "text-destructive")}>{formatCurrency(pnl?.net_profit || 0)}</p>
                  <p className="text-xs text-charcoal-lighter mt-1">
                    {pnl && pnl.total_sales > 0 ? `Margin: ${((pnl.net_profit / pnl.total_sales) * 100).toFixed(1)}%` : "No sales recorded yet"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-charcoal-lighter">Real Profit</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
                      <Sparkles className="h-4 w-4 text-success" />
                    </div>
                  </div>
                  <p className={cn("text-2xl font-bold [font-variant-numeric:tabular-nums]", (pnl?.real_profit || 0) >= 0 ? "text-charcoal" : "text-destructive")}>{formatCurrency(pnl?.real_profit || 0)}</p>
                  <p className="text-xs text-charcoal-lighter mt-1">Net profit after investor payouts &amp; loan repayments</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-charcoal-lighter">Total Liabilities</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10">
                      <Landmark className="h-4 w-4 text-warning" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(pnl?.total_liabilities || 0)}</p>
                  <p className="text-xs text-charcoal-lighter mt-1">Outstanding across all active loans</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-charcoal-lighter">Cash Balance</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10">
                      <Wallet className="h-4 w-4 text-secondary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-secondary [font-variant-numeric:tabular-nums]">{formatCurrency(cashBalance)}</p>
                  <p className="text-xs text-charcoal-lighter mt-1">Closing balance, {year}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg">Sales, COGS & Net Profit by Month</CardTitle>
                <AdminButton variant="outline" onClick={handleExportPnl} disabled={!data}>
                  <Download className="h-4 w-4 mr-1" /> Export
                </AdminButton>
              </CardHeader>
              <CardContent>
                {data && data.pnl_monthly.every((m) => m.sales === 0 && m.expenses === 0) ? (
                  <EmptyState icon={Receipt} title="No transactions yet" description={`No transactions recorded for ${data.year} yet.`} />
                ) : (
                  <div className="w-full" style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={300}>
                      <BarChart data={data?.pnl_monthly || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                        <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(0, 3)} tick={{ fontSize: 10, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="sales" name="Sales" fill="#7A4FA0" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cogs" name="COGS" fill="#E0B96C" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="#D9668F" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="net_profit" name="Net Profit" fill="#5C4058" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ SALES ═══ */}
          <TabsContent value="sales" className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales</SelectItem>
                  <SelectItem value="website">Website Only</SelectItem>
                  <SelectItem value="manual">Manual / Facebook Only</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <AdminButton variant="outline" onClick={handleExportTransactions} disabled={!data}>
                  <Download className="h-4 w-4 mr-1" /> Export
                </AdminButton>
                {canAddAccounting && (
                  <AdminButton onClick={() => setRecordSaleOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Record Sale
                  </AdminButton>
                )}
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Recent Transactions</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data && data.transactions.length === 0 ? (
                  <EmptyState icon={Receipt} title="No transactions yet" description="Recorded sales and refunds will show up here." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-left">
                          <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">Description</th>
                          <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter hidden sm:table-cell">Method</th>
                          <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter hidden lg:table-cell">Source</th>
                          <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter hidden md:table-cell">Date</th>
                          <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.transactions.map((txn) => (
                          <tr key={txn.id} className="border-b border-border/20 hover:bg-pearl/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "flex h-7 w-7 items-center justify-center rounded-full shrink-0",
                                  txn.type === "income" ? "bg-success/10" : "bg-warning/10"
                                )}>
                                  {txn.type === "income" ? (
                                    <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                                  ) : (
                                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                                  )}
                                </div>
                                <span className="text-charcoal truncate max-w-[250px]">{txn.description}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-charcoal-lighter hidden sm:table-cell">{txn.method}</td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {txn.source && (
                                <span className={cn("text-xs px-2 py-0.5 rounded-full", txn.source === "manual" ? "bg-secondary/10 text-secondary" : "bg-primary-100 text-charcoal-light")}>
                                  {txn.source === "manual" ? "Facebook/Manual" : "Website"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-charcoal-lighter hidden md:table-cell">{formatDate(txn.date)}</td>
                            <td
                              className={cn("px-4 py-3 font-medium text-right [font-variant-numeric:tabular-nums]", txn.amount > 0 ? "text-success" : "text-destructive")}
                            >
                              {txn.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(txn.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ EXPENSES ═══ */}
          <TabsContent value="expenses">
            <ExpensesTab year={year} />
          </TabsContent>

          {/* ═══ IMPORT COSTS ═══ */}
          <TabsContent value="import">
            <ImportBatchesTab />
          </TabsContent>

          {/* ═══ PARTNERS & EQUITY ═══ */}
          <TabsContent value="partners">
            <PartnersTab />
          </TabsContent>

          {/* ═══ LOANS & LIABILITIES ═══ */}
          <TabsContent value="loans">
            <LoansTab />
          </TabsContent>

          {/* ═══ CASH FLOW ═══ */}
          <TabsContent value="cashflow">
            <CashFlowTab year={year} />
          </TabsContent>

          {/* ═══ REPORTS ═══ */}
          <TabsContent value="reports" className="space-y-5">
            <div className="grid lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-secondary" /> Sales Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="w-full" style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={300}>
                      <AreaChart data={data?.pnl_monthly || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <defs>
                          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7A4FA0" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#7A4FA0" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                        <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(0, 3)} tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                        <Area type="monotone" dataKey="sales" name="Sales" stroke="#7A4FA0" fill="url(#salesGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-secondary" /> Profit Trend</CardTitle></CardHeader>
                <CardContent>
                  <div className="w-full" style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={300}>
                      <LineChart data={data?.pnl_monthly || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                        <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(0, 3)} tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="gross_profit" name="Gross Profit" stroke="#E0B96C" strokeWidth={2} dot={{ r: 2.5 }} />
                        <Line type="monotone" dataKey="net_profit" name="Net Profit" stroke="#5C4058" strokeWidth={2} dot={{ r: 2.5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="h-4 w-4 text-secondary" /> Expense Breakdown by Category</CardTitle></CardHeader>
              <CardContent>
                {data && data.expense_breakdown.length === 0 ? (
                  <EmptyState icon={PieChartIcon} title="No expenses yet" description={`No expenses recorded for ${data.year} yet.`} />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 items-center">
                    <div className="w-full" style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%" debounce={300}>
                        <PieChart>
                          <Pie data={data?.expense_breakdown || []} cx="50%" cy="50%" outerRadius={80} dataKey="amount" nameKey="category" stroke="none">
                            {(data?.expense_breakdown || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {(data?.expense_breakdown || []).map((row, i) => (
                        <div key={row.category} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="text-charcoal-light">{row.category}</span>
                          </div>
                          <span className="font-medium text-charcoal">{formatCurrency(row.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4 text-secondary" /> Liability Reduction Over Time</CardTitle></CardHeader>
              <CardContent>
                {data && data.liability_monthly.every((m) => m.outstanding_liability === 0) ? (
                  <EmptyState icon={Landmark} title="No active loans" description={`No active loans for ${data.year}.`} />
                ) : (
                  <div className="w-full" style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%" debounce={300}>
                      <AreaChart data={data?.liability_monthly || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <defs>
                          <linearGradient id="liabilityGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D9668F" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#D9668F" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                        <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(0, 3)} tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                        <Area type="monotone" dataKey="outstanding_liability" name="Outstanding Liability" stroke="#D9668F" fill="url(#liabilityGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <RecordSaleDialog
        open={recordSaleOpen}
        onOpenChange={setRecordSaleOpen}
        onRecorded={() => fetchData(year, sourceFilter)}
      />
    </div>
  );
}

// ─── Cash Flow tab (separate component: has its own year-independent monthly fetch) ───
interface CashFlowMonth { month: string; cash_in: number; cash_out: number; opening_balance: number; closing_balance: number; net: number; }
interface CashFlowData {
  opening_balance: number;
  cash_in: { orders: number; investments: number; loan_disbursements: number; total: number };
  cash_out: { expenses: number; withdrawals: number; loan_payments: number; refunds: number; total: number };
  closing_balance: number;
  monthly: CashFlowMonth[];
}

function CashFlowTab({ year }: { year: number }) {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/accounting/cashflow?year=${year}`)
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!data) return <EmptyState icon={Wallet} title="Could not load cash flow data" description="Try switching years or reloading the page." />;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <span className="text-sm text-charcoal-lighter">Opening Balance</span>
            <p className="text-2xl font-bold text-charcoal mt-2 [font-variant-numeric:tabular-nums]">{formatCurrency(data.opening_balance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <span className="text-sm text-charcoal-lighter">Cash In</span>
            <p className="text-2xl font-bold text-success mt-2 [font-variant-numeric:tabular-nums]">+{formatCurrency(data.cash_in.total)}</p>
            <p className="text-xs text-charcoal-lighter mt-1">Orders {formatCurrency(data.cash_in.orders)} · Investments {formatCurrency(data.cash_in.investments)} · Loans {formatCurrency(data.cash_in.loan_disbursements)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <span className="text-sm text-charcoal-lighter">Cash Out</span>
            <p className="text-2xl font-bold text-destructive mt-2 [font-variant-numeric:tabular-nums]">-{formatCurrency(data.cash_out.total)}</p>
            <p className="text-xs text-charcoal-lighter mt-1">Expenses {formatCurrency(data.cash_out.expenses)} · Withdrawals {formatCurrency(data.cash_out.withdrawals)} · Loan Payments {formatCurrency(data.cash_out.loan_payments)} · Refunds {formatCurrency(data.cash_out.refunds)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <span className="text-sm text-charcoal-lighter">Closing Balance</span>
            <p className="text-2xl font-bold text-secondary mt-2 [font-variant-numeric:tabular-nums]">{formatCurrency(data.closing_balance)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Cash In vs Cash Out by Month</CardTitle></CardHeader>
        <CardContent>
          <div className="w-full" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%" debounce={300}>
              <BarChart data={data.monthly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(0, 3)} tick={{ fontSize: 10, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: chartAxisLabel }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="cash_in" name="Cash In" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cash_out" name="Cash Out" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Monthly Balances</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter">Month</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter text-right">Opening</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter text-right">Cash In</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter text-right">Cash Out</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-lighter text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-border/20 hover:bg-pearl/50 transition-colors">
                    <td className="px-4 py-3 text-charcoal font-medium">{m.month}</td>
                    <td className="px-4 py-3 text-right text-charcoal-lighter [font-variant-numeric:tabular-nums]">{formatCurrency(m.opening_balance)}</td>
                    <td className="px-4 py-3 text-right text-success [font-variant-numeric:tabular-nums]">+{formatCurrency(m.cash_in)}</td>
                    <td className="px-4 py-3 text-right text-destructive [font-variant-numeric:tabular-nums]">-{formatCurrency(m.cash_out)}</td>
                    <td className="px-4 py-3 text-right font-medium text-charcoal [font-variant-numeric:tabular-nums]">{formatCurrency(m.closing_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
