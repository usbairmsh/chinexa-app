"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { triggerDashboardRefresh } from "@/lib/dashboard-events";
import {
  Search, MoreHorizontal, Eye, Truck, Package, Clock, CheckCircle2,
  XCircle, DollarSign, ArrowUpRight, Check,
  Download, Printer, ShoppingCart, PackageCheck, MapPin, ThumbsDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { formatCurrency, formatDateShort, getInitials, cn } from "@/lib/utils";

type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "on_delivery" | "received" | "not_received";
type PaymentStatus = "pending" | "paid" | "refunded";

interface Order {
  id: string; dbId: string; customer: string; phone: string; total: number; status: OrderStatus;
  payment: string; payment_status: PaymentStatus; items: number; date: string;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "text-warning", bg: "bg-warning/10", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-blue-500", bg: "bg-blue-50", icon: CheckCircle2 },
  processing: { label: "Processing", color: "text-secondary", bg: "bg-secondary/10", icon: Package },
  shipped: { label: "Shipped", color: "text-violet-500", bg: "bg-violet-50", icon: Truck },
  on_delivery: { label: "On Delivery", color: "text-indigo-500", bg: "bg-indigo-50", icon: MapPin },
  received: { label: "Received", color: "text-success", bg: "bg-success/10", icon: PackageCheck },
  not_received: { label: "Not Received", color: "text-destructive", bg: "bg-destructive/10", icon: ThumbsDown },
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "confirmed", confirmed: "processing", processing: "shipped", shipped: "on_delivery", on_delivery: "received",
};

export default function OrderManagementPage() {
  const [activeTab, setActiveTab] = useState<"all" | OrderStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusDialog, setStatusDialog] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus | "">("");
  const [cancelDialog, setCancelDialog] = useState<Order | null>(null);
  const [advanceDialog, setAdvanceDialog] = useState<Order | null>(null);

  // Fetch orders from DB
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders?page_size=200");
      const data = await res.json();
      setOrders((data?.data || []).map((o: Record<string, unknown>) => ({
        id: (o.order_number as string) || (o.id as string),
        dbId: o.id as string,
        customer: (o.customer_name as string) || "",
        phone: (o.customer_phone as string) || "",
        total: Number(o.total),
        status: (o.status as OrderStatus) || "pending",
        payment: (o.payment_method as string) || "COD",
        payment_status: (o.payment_status as PaymentStatus) || "pending",
        items: 0,
        date: (o.created_at as string) || new Date().toISOString(),
      })));
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleStatusChange = async () => {
    if (!statusDialog || !newStatus) return;
    await fetch(`/api/orders/${statusDialog.dbId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    // Reflect payment_status changes locally
    let updatedPayment = statusDialog.payment_status;
    const isCOD = statusDialog.payment.toLowerCase() === "cod";
    if (newStatus === "received" && isCOD) updatedPayment = "paid";
    if (newStatus === "confirmed" && !isCOD) updatedPayment = "paid";
    setOrders((prev) => prev.map((o) => o.id === statusDialog.id ? { ...o, status: newStatus, payment_status: updatedPayment } : o));
    triggerDashboardRefresh();
    setStatusDialog(null); setNewStatus("");
  };

  const handleNotReceived = async () => {
    if (!cancelDialog) return;
    await fetch(`/api/orders/${cancelDialog.dbId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "not_received" }),
    }).catch(() => {});
    setOrders((prev) => prev.map((o) => o.id === cancelDialog.id ? { ...o, status: "not_received" as OrderStatus } : o));
    triggerDashboardRefresh();
    setCancelDialog(null);
  };

  const handleQuickAdvance = (order: Order) => {
    const next = nextStatus[order.status];
    if (!next) return;
    setAdvanceDialog(order);
  };

  const confirmAdvance = async () => {
    if (!advanceDialog) return;
    const next = nextStatus[advanceDialog.status];
    if (!next) return;
    await fetch(`/api/orders/${advanceDialog.dbId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => {});
    // Reflect payment_status changes locally
    let updatedPayment = advanceDialog.payment_status;
    const isCOD = advanceDialog.payment.toLowerCase() === "cod";
    if (next === "received" && isCOD) updatedPayment = "paid";
    if (next === "confirmed" && !isCOD) updatedPayment = "paid";
    setOrders((prev) => prev.map((o) => o.id === advanceDialog.id ? { ...o, status: next, payment_status: updatedPayment } : o));
    triggerDashboardRefresh();
    setAdvanceDialog(null);
  };

  // Filters
  let filtered = orders;
  if (activeTab !== "all") filtered = filtered.filter((o) => o.status === activeTab);
  if (searchQuery) { const q = searchQuery.toLowerCase(); filtered = filtered.filter((o) => o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q) || o.phone.includes(q)); }
  if (paymentFilter !== "all") filtered = filtered.filter((o) => o.payment === paymentFilter);

  const revenue = orders.filter((o) => o.status === "received" && o.payment_status === "paid").reduce((s, o) => s + o.total, 0);

  const tabs: { id: "all" | OrderStatus; label: string; count: number }[] = [
    { id: "all", label: "All", count: orders.length },
    { id: "pending", label: "Pending", count: orders.filter((o) => o.status === "pending").length },
    { id: "confirmed", label: "Confirmed", count: orders.filter((o) => o.status === "confirmed").length },
    { id: "processing", label: "Processing", count: orders.filter((o) => o.status === "processing").length },
    { id: "shipped", label: "Shipped", count: orders.filter((o) => o.status === "shipped").length },
    { id: "on_delivery", label: "On Delivery", count: orders.filter((o) => o.status === "on_delivery").length },
    { id: "received", label: "Received", count: orders.filter((o) => o.status === "received").length },
    { id: "not_received", label: "Not Received", count: orders.filter((o) => o.status === "not_received").length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Order Management</h1>
          <p className="text-sm text-charcoal-lighter">{orders.length} orders · {formatCurrency(revenue)} revenue</p>
        </div>
        <AdminButton variant="outline" size="sm"><Download className="h-3.5 w-3.5" /> Export</AdminButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "Pending", value: orders.filter((o) => o.status === "pending").length, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
          { label: "In Progress", value: orders.filter((o) => ["confirmed", "processing"].includes(o.status)).length, icon: Package, color: "text-secondary", bg: "bg-secondary/10" },
          { label: "In Transit", value: orders.filter((o) => ["shipped", "on_delivery"].includes(o.status)).length, icon: Truck, color: "text-violet-500", bg: "bg-violet-50" },
          { label: "Received", value: orders.filter((o) => o.status === "received").length, icon: PackageCheck, color: "text-success", bg: "bg-success/10" },
          { label: "Not Received", value: orders.filter((o) => o.status === "not_received").length, icon: ThumbsDown, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Revenue", value: formatCurrency(revenue), icon: DollarSign, color: "text-gold", bg: "bg-gold/10" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-3 flex items-center gap-2.5">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", s.bg)}><s.icon className={cn("h-3.5 w-3.5", s.color)} /></div>
            <div><p className="text-base font-bold text-charcoal leading-tight">{s.value}</p><p className="text-[9px] text-charcoal-lighter">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all",
              activeTab === tab.id ? "bg-charcoal !text-white" : "bg-pearl text-charcoal-lighter hover:text-charcoal")}>
            {tab.label}
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", activeTab === tab.id ? "bg-white/20" : "bg-white")}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <div className="p-3 border-b border-border/20">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Search order, customer, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4" />} className="flex-1" />
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="bKash">bKash</SelectItem>
                <SelectItem value="Nagad">Nagad</SelectItem>
                <SelectItem value="COD">COD</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full text-sm"><tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/10"><td className="px-4 py-3" colSpan={6}><Skeleton className="h-10 w-full" /></td></tr>
              ))}
            </tbody></table>
          ) : filtered.length === 0 ? (
            <div className="py-16">
              <EmptyState icon={ShoppingCart} title="No orders yet" description="Orders will appear here when customers place them through the store." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20 text-left">
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Order</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">Payment</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Total</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((order) => {
                    const config = statusConfig[order.status];
                    const Icon = config.icon;
                    const next = nextStatus[order.status];
                    return (
                      <motion.tr key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="border-b border-border/10 hover:bg-pearl/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/orders/${order.id}`} className="group">
                            <p className="font-semibold text-charcoal group-hover:text-secondary transition-colors">{order.id}</p>
                            <p className="text-[10px] text-charcoal-lighter">{formatDateShort(order.date)}</p>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="text-[9px]">{getInitials(order.customer)}</AvatarFallback></Avatar>
                            <div className="min-w-0"><p className="text-xs text-charcoal truncate">{order.customer}</p><p className="text-[10px] text-charcoal-lighter">{order.phone}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <p className="text-xs text-charcoal">{order.payment}</p>
                          <Badge variant={order.payment_status === "paid" ? "success" : order.payment_status === "refunded" ? "warning" : "default"} className="text-[8px] mt-0.5">{order.payment_status}</Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold text-charcoal">{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full", config.color, config.bg)}>
                            <Icon className="h-3 w-3" /> {config.label}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View */}
                            <Link href={`/admin/orders/${order.id}`}
                              className="flex h-8 items-center gap-1 px-2.5 rounded-lg border border-border text-[10px] font-medium text-charcoal-lighter hover:text-charcoal hover:border-charcoal transition-all">
                              <Eye className="h-3 w-3" /> <span className="hidden xl:inline">View</span>
                            </Link>

                            {/* Advance Status */}
                            {next ? (
                              <button onClick={() => handleQuickAdvance(order)}
                                className="flex h-8 items-center gap-1 px-2.5 rounded-lg bg-charcoal text-[10px] font-semibold !text-white hover:bg-secondary hover:shadow-[0_2px_12px_rgba(192,57,43,0.25)] transition-all">
                                <ArrowUpRight className="h-3 w-3" /> <span className="hidden xl:inline">{statusConfig[next].label}</span>
                              </button>
                            ) : null}

                            {/* More */}
                            <DropdownMenu>
                              <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-pearl transition-colors">
                                <MoreHorizontal className="h-3.5 w-3.5 text-charcoal-lighter" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setStatusDialog(order); setNewStatus(""); }}><Package className="h-3.5 w-3.5 mr-2" /> Change Status</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/invoice?id=${encodeURIComponent(order.dbId)}`, "_blank")}><Printer className="h-3.5 w-3.5 mr-2" /> Print Invoice</DropdownMenuItem>
                                {!["not_received", "received"].includes(order.status) && (
                                  <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => setCancelDialog(order)}><ThumbsDown className="h-3.5 w-3.5 mr-2" /> Not Received</DropdownMenuItem></>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Change Status Dialog */}
      <Dialog open={!!statusDialog} onOpenChange={(open) => !open && setStatusDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>{statusDialog?.id} — {statusDialog?.customer}</DialogDescription>
          </DialogHeader>
          {statusDialog && (
            <div className="space-y-3">
              <p className="text-xs text-charcoal-lighter">Current: <span className={statusConfig[statusDialog.status].color + " font-semibold"}>{statusConfig[statusDialog.status].label}</span></p>
              <div className="grid grid-cols-2 gap-2">
                {(["pending", "confirmed", "processing", "shipped", "on_delivery", "received", "not_received"] as OrderStatus[]).map((s) => {
                  const sc = statusConfig[s];
                  return (
                    <button key={s} onClick={() => setNewStatus(s)} disabled={s === statusDialog.status}
                      className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all",
                        newStatus === s ? "border-secondary bg-secondary/5 text-secondary" : "border-border text-charcoal-light hover:border-charcoal",
                        s === statusDialog.status && "opacity-30 cursor-not-allowed")}>
                      <sc.icon className="h-4 w-4" /> {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setStatusDialog(null)}>Cancel</AdminButton>
            <AdminButton onClick={handleStatusChange} disabled={!newStatus}>Update</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Not Received Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ThumbsDown className="h-5 w-5 text-destructive" /> Mark as Not Received</DialogTitle>
            <DialogDescription>This will flag the customer as a potential fraud case and add them to the fraud alerts list.</DialogDescription>
          </DialogHeader>
          {cancelDialog && <p className="text-sm text-charcoal-light">{cancelDialog.id} — {cancelDialog.customer} — {formatCurrency(cancelDialog.total)} via {cancelDialog.payment}</p>}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setCancelDialog(null)}>Go Back</AdminButton>
            <AdminButton variant="danger" onClick={handleNotReceived}><ThumbsDown className="h-3.5 w-3.5" /> Confirm Not Received</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance Status Confirmation */}
      <Dialog open={!!advanceDialog} onOpenChange={(open) => !open && setAdvanceDialog(null)}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowUpRight className="h-5 w-5 text-secondary" /> Advance Order Status</DialogTitle>
            <DialogDescription>Confirm status change for this order</DialogDescription>
          </DialogHeader>
          {advanceDialog && (() => {
            const next = nextStatus[advanceDialog.status];
            if (!next) return null;
            const currentConfig = statusConfig[advanceDialog.status];
            const nextConfig = statusConfig[next];
            const CurrentIcon = currentConfig.icon;
            const NextIcon = nextConfig.icon;
            return (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-pearl/60">
                  <p className="text-sm font-medium text-charcoal">{advanceDialog.id}</p>
                  <p className="text-xs text-charcoal-lighter">{advanceDialog.customer} · {formatCurrency(advanceDialog.total)}</p>
                </div>
                <div className="flex items-center justify-center gap-3 py-2">
                  <div className="text-center">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full", currentConfig.color, currentConfig.bg)}>
                      <CurrentIcon className="h-3.5 w-3.5" /> {currentConfig.label}
                    </span>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-charcoal-lighter" />
                  <div className="text-center">
                    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full ring-2 ring-secondary/30", nextConfig.color, nextConfig.bg)}>
                      <NextIcon className="h-3.5 w-3.5" /> {nextConfig.label}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-charcoal-lighter text-center">
                  The customer will be notified about this status change.
                </p>
              </div>
            );
          })()}
          <DialogFooter>
            <AdminButton variant="outline" onClick={() => setAdvanceDialog(null)}>Cancel</AdminButton>
            <AdminButton onClick={confirmAdvance}><Check className="h-3.5 w-3.5" /> Confirm</AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
