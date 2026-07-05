"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign, TrendingUp, TrendingDown, Download, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, cn } from "@/lib/utils";

interface MonthRow { month: string; revenue: number; refunds: number; orders: number; }
interface Txn { id: string; type: "income" | "refund"; description: string; amount: number; method: string; date: string; }
interface AccountingData {
  year: number;
  years: number[];
  summary: { total_revenue: number; total_refunds: number; net: number; total_orders: number };
  monthly: MonthRow[];
  transactions: Txn[];
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminAccountingPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (y: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/accounting?year=${y}`);
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

  useEffect(() => { fetchData(year); }, [fetchData, year]);

  const handleExport = () => {
    if (!data) return;
    const lines = [
      "Type,Description,Method,Date,Amount",
      ...data.transactions.map((t) =>
        `${t.type},"${t.description.replace(/"/g, '""')}",${t.method},${formatDate(t.date)},${t.amount}`
      ),
      "",
      "Month,Revenue,Refunds,Orders",
      ...data.monthly.map((m) => `${m.month},${m.revenue},${m.refunds},${m.orders}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting-${data.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = data?.summary;
  const maxMonthly = Math.max(1, ...(data?.monthly.map((m) => m.revenue) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Accounting</h1>
          <p className="text-sm text-charcoal-lighter">Financial overview and transaction history</p>
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
          <AdminButton variant="outline" onClick={handleExport} disabled={!data}>
            <Download className="h-4 w-4 mr-1" /> Export
          </AdminButton>
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
        <>
          {/* Summary Cards */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-charcoal-lighter">Total Revenue ({data?.year})</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-charcoal">{formatCurrency(summary?.total_revenue || 0)}</p>
                <p className="text-xs text-charcoal-lighter mt-1">{summary?.total_orders || 0} orders</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-charcoal-lighter">Refunds</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-charcoal">{formatCurrency(summary?.total_refunds || 0)}</p>
                <p className="text-xs text-charcoal-lighter mt-1">Approved & refunded returns</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-charcoal-lighter">Net Revenue</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10">
                    <DollarSign className="h-4 w-4 text-secondary" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-charcoal">{formatCurrency(summary?.net || 0)}</p>
                <p className="text-xs text-charcoal-lighter mt-1">
                  {summary && summary.total_revenue > 0
                    ? `Margin after refunds: ${((summary.net / summary.total_revenue) * 100).toFixed(1)}%`
                    : "No revenue recorded yet"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Monthly Overview</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader><CardTitle className="text-lg">Revenue & Refunds by Month</CardTitle></CardHeader>
                <CardContent>
                  {data && data.monthly.every((m) => m.revenue === 0 && m.refunds === 0) ? (
                    <p className="text-sm text-charcoal-lighter py-6 text-center">No transactions recorded for {data.year} yet.</p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {data?.monthly.map((m) => (
                          <div key={m.month}>
                            <div className="flex items-center justify-between text-sm mb-1.5 gap-2 sm:gap-0">
                              <span className="text-charcoal font-medium w-8 sm:w-20 shrink-0">{m.month.slice(0, 3)}</span>
                              <div className="flex-1 mx-2 sm:mx-4">
                                <div className="flex gap-1 h-5">
                                  <div
                                    className="bg-gradient-to-r from-secondary to-primary rounded-full"
                                    style={{ width: `${Math.min(100, (m.revenue / maxMonthly) * 100)}%` }}
                                  />
                                  {m.refunds > 0 && (
                                    <div
                                      className="bg-destructive/30 rounded-full"
                                      style={{ width: `${Math.min(100, (m.refunds / maxMonthly) * 100)}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                              <div className="text-right w-24 sm:w-44 shrink-0">
                                <span className="text-charcoal font-medium text-xs sm:text-sm">{formatCurrency(m.revenue)}</span>
                                {m.refunds > 0 && (
                                  <span className="text-charcoal-lighter text-[10px] sm:text-xs block sm:inline sm:ml-2">- {formatCurrency(m.refunds)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-6 mt-4 pt-4 border-t border-border/30">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="h-2.5 w-2.5 rounded-full bg-secondary" />
                          <span className="text-charcoal-lighter">Revenue</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="h-2.5 w-2.5 rounded-full bg-destructive/30" />
                          <span className="text-charcoal-lighter">Refunds</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader><CardTitle className="text-lg">Recent Transactions</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {data && data.transactions.length === 0 ? (
                    <p className="text-sm text-charcoal-lighter py-6 text-center">No transactions yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/30 text-left">
                            <th className="px-4 py-3 font-medium text-charcoal-lighter">Description</th>
                            <th className="px-4 py-3 font-medium text-charcoal-lighter hidden sm:table-cell">Method</th>
                            <th className="px-4 py-3 font-medium text-charcoal-lighter hidden md:table-cell">Date</th>
                            <th className="px-4 py-3 font-medium text-charcoal-lighter text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data?.transactions.map((txn) => (
                            <tr key={txn.id} className="border-b border-border/20 hover:bg-pearl/50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full",
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
                              <td className="px-4 py-3 text-charcoal-lighter hidden md:table-cell">{formatDate(txn.date)}</td>
                              <td className={cn("px-4 py-3 font-medium text-right", txn.amount > 0 ? "text-success" : "text-destructive")}>
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
          </Tabs>
        </>
      )}
    </div>
  );
}
