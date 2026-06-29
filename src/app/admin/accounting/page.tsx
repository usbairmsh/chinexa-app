"use client";

import { DollarSign, TrendingUp, TrendingDown, Receipt, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, cn } from "@/lib/utils";

const revenueData = [
  { month: "January", revenue: 285000, expenses: 42000, orders: 38 },
  { month: "February", revenue: 312000, expenses: 45000, orders: 42 },
  { month: "March", revenue: 398000, expenses: 51000, orders: 55 },
  { month: "April", revenue: 345000, expenses: 48000, orders: 47 },
  { month: "May", revenue: 425000, expenses: 55000, orders: 62 },
  { month: "June", revenue: 520600, expenses: 62000, orders: 78 },
];

const recentTransactions = [
  { id: "txn-1", type: "income", description: "Order #ORD-0527 — Fatima Akter", amount: 8500, method: "bKash", date: "Jun 28, 2026" },
  { id: "txn-2", type: "income", description: "Order #ORD-0526 — Ayesha Rahman", amount: 12400, method: "Nagad", date: "Jun 28, 2026" },
  { id: "txn-3", type: "expense", description: "Shipping Partner — June Settlement", amount: -45000, method: "Bank Transfer", date: "Jun 27, 2026" },
  { id: "txn-4", type: "income", description: "Order #ORD-0525 — Nusrat Jahan", amount: 6200, method: "COD", date: "Jun 27, 2026" },
  { id: "txn-5", type: "expense", description: "Product Photography — Q2 Batch", amount: -15000, method: "Bank Transfer", date: "Jun 26, 2026" },
  { id: "txn-6", type: "income", description: "Order #ORD-0524 — Sadia Islam", amount: 18900, method: "Card", date: "Jun 26, 2026" },
  { id: "txn-7", type: "refund", description: "Refund — Order #ORD-0518", amount: -3200, method: "bKash", date: "Jun 25, 2026" },
  { id: "txn-8", type: "expense", description: "Packaging Materials", amount: -8500, method: "COD", date: "Jun 25, 2026" },
  { id: "txn-9", type: "income", description: "Order #ORD-0523 — Tamanna Akter", amount: 4800, method: "Nagad", date: "Jun 24, 2026" },
  { id: "txn-10", type: "income", description: "Order #ORD-0522 — Priya Das", amount: 22100, method: "Card", date: "Jun 24, 2026" },
];

const totalRevenue = revenueData.reduce((s, r) => s + r.revenue, 0);
const totalExpenses = revenueData.reduce((s, r) => s + r.expenses, 0);
const netProfit = totalRevenue - totalExpenses;

export default function AdminAccountingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Accounting</h1>
          <p className="text-sm text-charcoal-lighter">Financial overview and transaction history</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="2026">
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
            </SelectContent>
          </Select>
          <AdminButton variant="outline"><Download className="h-4 w-4 mr-1" /> Export</AdminButton>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-charcoal-lighter">Total Revenue</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
            </div>
            <p className="text-2xl font-bold text-charcoal">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-success flex items-center gap-1 mt-1">
              <ArrowUpRight className="h-3 w-3" /> +18.4% vs last period
            </p>
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
            <p className="text-2xl font-bold text-charcoal">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
              <ArrowDownRight className="h-3 w-3" /> +5.2% vs last period
            </p>
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
            <p className="text-2xl font-bold text-charcoal">{formatCurrency(netProfit)}</p>
            <p className="text-xs text-charcoal-lighter mt-1">
              Margin: {((netProfit / totalRevenue) * 100).toFixed(1)}%
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
            <CardHeader><CardTitle className="text-lg">Revenue & Expenses by Month</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {revenueData.map((m) => (
                  <div key={m.month}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-charcoal font-medium w-20">{m.month.slice(0, 3)}</span>
                      <div className="flex-1 mx-4">
                        <div className="flex gap-1 h-5">
                          <div
                            className="bg-gradient-to-r from-secondary to-primary rounded-full"
                            style={{ width: `${(m.revenue / 600000) * 100}%` }}
                          />
                          <div
                            className="bg-destructive/30 rounded-full"
                            style={{ width: `${(m.expenses / 600000) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right w-40">
                        <span className="text-charcoal font-medium">{formatCurrency(m.revenue)}</span>
                        <span className="text-charcoal-lighter text-xs ml-2">- {formatCurrency(m.expenses)}</span>
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
                  <span className="text-charcoal-lighter">Expenses</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader><CardTitle className="text-lg">Recent Transactions</CardTitle></CardHeader>
            <CardContent className="p-0">
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
                    {recentTransactions.map((txn) => (
                      <tr key={txn.id} className="border-b border-border/20 hover:bg-pearl/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full",
                              txn.type === "income" ? "bg-success/10" : txn.type === "refund" ? "bg-warning/10" : "bg-destructive/10"
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
                        <td className="px-4 py-3 text-charcoal-lighter hidden md:table-cell">{txn.date}</td>
                        <td className={cn("px-4 py-3 font-medium text-right", txn.amount > 0 ? "text-success" : "text-destructive")}>
                          {txn.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(txn.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
