"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Search, Users, DollarSign, ShoppingCart, TrendingUp, ArrowUpDown,
  ChevronRight, Mail, Phone, Edit,
  MapPin, Package, Clock, CheckCircle2, Truck, XCircle, Calendar,
  ArrowLeft, Loader2, Crown, Gift, Plus, Tag, Save
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { formatCurrency, formatDateShort, getInitials, cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────
interface OrderProduct {
  name: string; image: string; qty: number; price: number;
}

interface CustomerOrder {
  id: string; date: string; total: number; items: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "on_delivery" | "received" | "not_received";
  products: OrderProduct[];
}

interface Customer {
  id: string; name: string; email: string; phone: string; avatar?: string;
  division: string; district: string; address: string;
  totalOrders: number; totalSpent: number; totalItems: number;
  avgOrderValue: number; lastOrderDate: string; joinedDate: string;
  isActive: boolean; tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  orders: CustomerOrder[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "text-warning", bg: "bg-warning/10", icon: Clock },
  confirmed: { label: "Confirmed", color: "text-blue-500", bg: "bg-blue-50", icon: CheckCircle2 },
  processing: { label: "Processing", color: "text-secondary", bg: "bg-secondary/10", icon: Package },
  shipped: { label: "Shipped", color: "text-violet-500", bg: "bg-violet-50", icon: Truck },
  delivered: { label: "Delivered", color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
  returned: { label: "Returned", color: "text-orange-500", bg: "bg-orange-50", icon: Package },
};

const tierColors: Record<string, string> = {
  Bronze: "bg-orange-100 text-orange-700",
  Silver: "bg-gray-100 text-gray-600",
  Gold: "bg-amber-50 text-amber-700",
  Platinum: "bg-violet-50 text-violet-700",
};

type SortKey = "name" | "orders" | "spent" | "lastOrder" | "joined";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : "";
}

export default function AdminCustomersPage() {
  const adminRole = getCookie("chinexa-role");
  const canEditCustomer = adminRole === "superadmin";

  // Edit customer dialog
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("spent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Membership state
  const [membershipData, setMembershipData] = useState<{
    total_points: number;
    tier: { name: string; color: string; min_points: number; max_points: number; points_multiplier: number; benefits: string[] } | null;
    next_tier: { name: string; min_points: number; max_points: number } | null;
    points_to_next_tier: number;
    history: { id: string; points: number; type: string; description: string; created_at: string }[];
  } | null>(null);
  const [customerCoupons, setCustomerCoupons] = useState<{ id: string; coupon_code: string; coupon_description: string; discount_type: string; discount_value: number; is_used: boolean; valid_until: string }[]>([]);
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false);
  const [pointsAmount, setPointsAmount] = useState(0);
  const [pointsNote, setPointsNote] = useState("");
  const [pointsType, setPointsType] = useState<"bonus" | "admin_adjustment">("bonus");
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<{ id: string; code: string; description: string; discount_type: string; discount_value: number }[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState("");

  // Fetch customers from DB
  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers?page_size=100");
      const data = await res.json();
      if (data?.data && Array.isArray(data.data)) {
        setDbCustomers(data.data.map((c: Record<string, unknown>) => ({
          id: c.id as string, name: c.name as string, email: (c.email as string) || "",
          phone: c.phone as string, division: "", district: "", address: "",
          totalOrders: Number(c.total_orders) || 0, totalSpent: Number(c.total_spent) || 0,
          totalItems: Number(c.total_items) || 0, avgOrderValue: Number(c.total_orders) > 0 ? Math.round(Number(c.total_spent) / Number(c.total_orders)) : 0,
          lastOrderDate: (c.last_order_at as string) || (c.created_at as string) || "", joinedDate: (c.created_at as string) || "",
          isActive: c.is_active !== false, tier: Number(c.total_spent) >= 100000 ? "Platinum" as const : Number(c.total_spent) >= 50000 ? "Gold" as const : Number(c.total_spent) >= 20000 ? "Silver" as const : "Bronze" as const,
          orders: [],
        })));
      }
    } catch {}
  };
  useEffect(() => { fetchCustomers(); }, []);

  // Fetch membership data for selected customer
  const fetchMembershipData = async (customerId: string) => {
    try {
      const [pointsRes, couponsRes] = await Promise.all([
        fetch(`/api/customers/${customerId}/points`),
        fetch(`/api/customers/${customerId}/coupons`),
      ]);
      const pointsData = await pointsRes.json();
      const couponsData = await couponsRes.json();
      if (pointsData && !pointsData.error) setMembershipData(pointsData);
      if (Array.isArray(couponsData)) setCustomerCoupons(couponsData);
    } catch {}
  };

  const handleGivePoints = async () => {
    if (!selectedCustomer || !pointsAmount) return;
    try {
      await fetch(`/api/customers/${selectedCustomer.id}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: pointsAmount, type: pointsType, description: pointsNote || `Admin ${pointsType === "bonus" ? "bonus" : "adjustment"}` }),
      });
      setPointsDialogOpen(false);
      setPointsAmount(0);
      setPointsNote("");
      fetchMembershipData(selectedCustomer.id);
    } catch {}
  };

  const handleAssignCoupon = async () => {
    if (!selectedCustomer || !selectedCouponId) return;
    try {
      await fetch(`/api/customers/${selectedCustomer.id}/coupons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon_id: selectedCouponId }),
      });
      setCouponDialogOpen(false);
      setSelectedCouponId("");
      fetchMembershipData(selectedCustomer.id);
    } catch {}
  };

  const openCouponDialog = async () => {
    try {
      const res = await fetch("/api/coupons");
      const data = await res.json();
      if (Array.isArray(data)) setAvailableCoupons(data.filter((c: { is_active: boolean }) => c.is_active));
    } catch {}
    setCouponDialogOpen(true);
  };

  const openEditCustomer = () => {
    if (!selectedCustomer) return;
    setEditName(selectedCustomer.name);
    setEditEmail(selectedCustomer.email);
    setEditPhone(selectedCustomer.phone);
    setEditActive(selectedCustomer.isActive);
    setEditCustomerOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer) return;
    setEditSaving(true);
    try {
      await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() || null, phone: editPhone.trim(), is_active: editActive }),
      });
      setEditCustomerOpen(false);
      // Update local state
      setSelectedCustomer({ ...selectedCustomer, name: editName.trim(), email: editEmail.trim(), phone: editPhone.trim(), isActive: editActive });
      fetchCustomers();
    } catch {} finally { setEditSaving(false); }
  };

  // Fetch customer detail with orders when selecting
  const handleSelectCustomer = async (customer: Customer) => {
    setLoadingDetail(true);
    setSelectedCustomer(customer);
    try {
      const res = await fetch(`/api/customers/${customer.id}`);
      const data = await res.json();
      if (data && !data.error) {
        const orders: CustomerOrder[] = (data.orders || []).map((o: Record<string, unknown>) => {
          const items = (o.items as OrderProduct[]) || [];
          return {
            id: (o.order_number as string) || (o.id as string),
            date: (o.created_at as string) || "",
            total: Number(o.total),
            items: items.length,
            status: (o.status as CustomerOrder["status"]) || "pending",
            products: items,
          };
        });
        // Update address info from detail
        const addr = data.addresses?.[0];
        setSelectedCustomer({
          ...customer,
          address: addr ? [addr.address_line_1, addr.district, addr.division].filter(Boolean).join(", ") : customer.address,
          division: addr?.division || "",
          district: addr?.district || "",
          orders,
        });
      }
    } catch {} finally { setLoadingDetail(false); }
    fetchMembershipData(customer.id);
  };

  // Use DB data
  const activeCustomers = dbCustomers;

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = [...activeCustomers];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q));
    }
    if (statusFilter === "active") list = list.filter((c) => c.isActive);
    if (statusFilter === "inactive") list = list.filter((c) => !c.isActive);
    if (tierFilter !== "all") list = list.filter((c) => c.tier === tierFilter);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "orders") cmp = a.totalOrders - b.totalOrders;
      else if (sortBy === "spent") cmp = a.totalSpent - b.totalSpent;
      else if (sortBy === "lastOrder") cmp = new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime();
      else if (sortBy === "joined") cmp = new Date(a.joinedDate).getTime() - new Date(b.joinedDate).getTime();
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [activeCustomers, searchQuery, statusFilter, tierFilter, sortBy, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const totalRevenue = activeCustomers.reduce((s, c) => s + c.totalSpent, 0);
  const totalOrders = activeCustomers.reduce((s, c) => s + c.totalOrders, 0);
  const avgLifetimeValue = activeCustomers.length > 0 ? Math.round(totalRevenue / activeCustomers.length) : 0;

  // ─── CUSTOMER DETAIL PANEL ───
  if (selectedCustomer) {
    const c = selectedCustomer;
    const tierName = membershipData?.tier?.name || c.tier;
    const tierColor = membershipData?.tier?.color || tierColors[c.tier] || "";
    const totalPoints = membershipData?.total_points || 0;
    const nextTier = membershipData?.next_tier;
    // Guard divide-by-zero when a tier has min_points === max_points
    const tierRange = membershipData?.tier ? membershipData.tier.max_points - membershipData.tier.min_points : 0;
    const rawProgress = membershipData?.tier && tierRange > 0
      ? ((totalPoints - membershipData.tier.min_points) / tierRange) * 100
      : 0;
    const progressPercent = Number.isFinite(rawProgress) ? Math.max(0, Math.min(100, rawProgress)) : 0;

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedCustomer(null); setMembershipData(null); setCustomerCoupons([]); }} className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading text-xl font-semibold text-charcoal">{c.name}</h1>
            <p className="text-xs text-charcoal-lighter">Customer since {formatDateShort(c.joinedDate)}</p>
          </div>
          <Badge className={cn("text-[10px]", tierColor)}><Crown className="h-3 w-3 mr-1" />{tierName}</Badge>
          <Badge variant={c.isActive ? "success" : "destructive"} className="text-[10px]">{c.isActive ? "Active" : "Inactive"}</Badge>
          {canEditCustomer && (
            <button onClick={openEditCustomer} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-[11px] font-medium text-charcoal-lighter hover:border-secondary hover:text-secondary transition-all">
              <Edit className="h-3 w-3" /> Edit
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: Profile + Membership + Stats */}
          <div className="space-y-5">
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-col items-center text-center mb-4">
                  <Avatar className="h-16 w-16 mb-3 ring-2 ring-primary-light"><AvatarFallback className="text-xl font-semibold bg-secondary text-white">{getInitials(c.name)}</AvatarFallback></Avatar>
                  <h2 className="font-heading text-lg font-semibold text-charcoal">{c.name}</h2>
                  <Badge className={cn("text-[9px] mt-1", tierColor)}>{tierName} Member</Badge>
                </div>
                <Separator className="my-3" />
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-charcoal-lighter"><Phone className="h-3.5 w-3.5 text-secondary" /> {c.phone}</div>
                  {c.email && <div className="flex items-center gap-2 text-charcoal-lighter"><Mail className="h-3.5 w-3.5 text-secondary" /> {c.email}</div>}
                  {c.address && <div className="flex items-start gap-2 text-charcoal-lighter"><MapPin className="h-3.5 w-3.5 text-secondary mt-0.5" /> {c.address}</div>}
                  <div className="flex items-center gap-2 text-charcoal-lighter"><Calendar className="h-3.5 w-3.5 text-secondary" /> Joined {formatDateShort(c.joinedDate)}</div>
                </div>
              </CardContent>
            </Card>

            {/* Membership & Points Card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Crown className="h-4 w-4 text-gold" /> Loyalty Points</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <p className="text-3xl font-bold text-charcoal">{totalPoints.toLocaleString()}</p>
                  <p className="text-[10px] text-charcoal-lighter">total points</p>
                </div>
                {membershipData?.tier && (
                  <div>
                    <div className="flex justify-between text-[10px] text-charcoal-lighter mb-1">
                      <span>{membershipData.tier.name} ({membershipData.tier.min_points})</span>
                      <span>{nextTier ? `${nextTier.name} (${nextTier.min_points})` : "Max Tier"}</span>
                    </div>
                    <Progress value={Math.min(progressPercent, 100)} />
                    {nextTier && (
                      <p className="text-[9px] text-charcoal-lighter mt-1 text-center">
                        {membershipData.points_to_next_tier} points to {nextTier.name}
                      </p>
                    )}
                  </div>
                )}
                {membershipData?.tier?.points_multiplier && membershipData.tier.points_multiplier > 1 && (
                  <p className="text-[10px] text-center text-secondary font-medium">
                    {membershipData.tier.points_multiplier}x points multiplier active
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setPointsType("bonus"); setPointsDialogOpen(true); }} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-border/30 text-[11px] font-medium text-charcoal hover:bg-pearl transition-colors">
                    <Plus className="h-3 w-3" /> Give Points
                  </button>
                  <button onClick={openCouponDialog} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-border/30 text-[11px] font-medium text-charcoal hover:bg-pearl transition-colors">
                    <Gift className="h-3 w-3" /> Assign Coupon
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Assigned Coupons */}
            {customerCoupons.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4 text-secondary" /> Assigned Coupons</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {customerCoupons.map((cc) => (
                    <div key={cc.id} className="flex items-center justify-between p-2 rounded-lg bg-pearl/40">
                      <div>
                        <p className="text-xs font-semibold text-charcoal">{cc.coupon_code}</p>
                        <p className="text-[9px] text-charcoal-lighter">{cc.discount_type === "percentage" ? `${cc.discount_value}% off` : `${formatCurrency(cc.discount_value)} off`}</p>
                      </div>
                      <Badge variant={cc.is_used ? "destructive" : "success"} className="text-[9px]">{cc.is_used ? "Used" : "Active"}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Orders", value: c.totalOrders, icon: ShoppingCart, color: "text-secondary bg-secondary/10" },
                { label: "Items Bought", value: c.totalItems, icon: Package, color: "text-blue-500 bg-blue-50" },
                { label: "Total Spent", value: formatCurrency(c.totalSpent), icon: DollarSign, color: "text-success bg-success/10" },
                { label: "Avg. Order", value: formatCurrency(c.avgOrderValue), icon: TrendingUp, color: "text-gold bg-gold/10" },
              ].map((s) => (
                <Card key={s.label}><CardContent className="p-3 text-center">
                  <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg mb-1.5", s.color)}><s.icon className="h-3.5 w-3.5" /></div>
                  <p className="text-base font-bold text-charcoal truncate">{s.value}</p>
                  <p className="text-[9px] text-charcoal-lighter">{s.label}</p>
                </CardContent></Card>
              ))}
            </div>
          </div>

          {/* Right: Points History + Order History */}
          <div className="lg:col-span-2 space-y-5">
            {/* Points History */}
            {membershipData?.history && membershipData.history.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Points History</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {membershipData.history.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                        <div>
                          <p className="text-xs text-charcoal">{entry.description || entry.type}</p>
                          <p className="text-[9px] text-charcoal-lighter">{formatDateShort(entry.created_at)}</p>
                        </div>
                        <span className={cn("text-sm font-semibold", entry.points > 0 ? "text-success" : "text-destructive")}>
                          {entry.points > 0 ? "+" : ""}{entry.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order History */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Order History ({c.orders.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {loadingDetail && c.orders.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-charcoal-lighter">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading orders...
                  </div>
                )}
                {!loadingDetail && c.orders.length === 0 && (
                  <p className="text-sm text-charcoal-lighter text-center py-8">No orders found for this customer</p>
                )}
                {c.orders.map((order) => {
                  const sc = statusConfig[order.status] || { label: order.status, color: "text-charcoal-lighter", bg: "bg-pearl", icon: Clock };
                  const Icon = sc.icon;
                  return (
                    <div key={order.id} className="rounded-xl border border-border/20 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-pearl/40">
                        <div className="flex items-center gap-4 text-xs min-w-0">
                          <div className="min-w-0"><p className="text-[9px] text-charcoal-lighter uppercase">Order</p><p className="font-semibold text-charcoal truncate">{order.id}</p></div>
                          <div className="hidden sm:block shrink-0"><p className="text-[9px] text-charcoal-lighter uppercase">Date</p><p className="text-charcoal">{formatDateShort(order.date)}</p></div>
                          <div className="shrink-0"><p className="text-[9px] text-charcoal-lighter uppercase">Total</p><p className="font-semibold text-charcoal">{formatCurrency(order.total)}</p></div>
                        </div>
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0", sc.color, sc.bg)}>
                          <Icon className="h-3 w-3" /> {sc.label}
                        </span>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {order.products.map((p, i) => (
                          <div key={i} className="flex items-center gap-3">
                            {p.image && (
                              <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-pearl shrink-0">
                                <Image src={p.image} alt={p.name} fill className="object-cover" sizes="40px" unoptimized={p.image.includes("/uploads/")} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-charcoal truncate">{p.name}</p>
                              <p className="text-[10px] text-charcoal-lighter">Qty: {p.qty}</p>
                            </div>
                            <p className="text-xs font-medium text-charcoal shrink-0">{formatCurrency(p.price)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Give Points Dialog */}
        <Dialog open={pointsDialogOpen} onOpenChange={setPointsDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{pointsType === "bonus" ? "Give Bonus Points" : "Adjust Points"}</DialogTitle>
              <DialogDescription>Add or deduct points for {c.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="flex gap-2">
                <button type="button" onClick={() => setPointsType("bonus")} className={cn("flex-1 py-2 rounded-lg text-xs font-medium border transition-all", pointsType === "bonus" ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter")}>Bonus</button>
                <button type="button" onClick={() => setPointsType("admin_adjustment")} className={cn("flex-1 py-2 rounded-lg text-xs font-medium border transition-all", pointsType === "admin_adjustment" ? "border-secondary bg-secondary/10 text-secondary" : "border-border/30 text-charcoal-lighter")}>Adjustment</button>
              </div>
              <Input label="Points *" type="number" value={pointsAmount} onChange={(e) => setPointsAmount(Number(e.target.value))} placeholder="e.g. 100 or -50" />
              <Input label="Note" value={pointsNote} onChange={(e) => setPointsNote(e.target.value)} placeholder="e.g. Birthday bonus" />
            </div>
            <DialogFooter>
              <button onClick={() => setPointsDialogOpen(false)} className="px-4 py-2 text-xs text-charcoal-lighter hover:text-charcoal">Cancel</button>
              <button onClick={handleGivePoints} disabled={!pointsAmount} className="px-4 py-2 rounded-full bg-secondary text-white text-xs font-semibold hover:bg-secondary-dark hover:shadow-[0_6px_25px_rgba(192,57,43,0.3)] hover:-translate-y-[1px] active:scale-[0.96] disabled:opacity-40 transition-all duration-300">
                {pointsAmount >= 0 ? "Give" : "Deduct"} {Math.abs(pointsAmount)} Points
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Coupon Dialog */}
        <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign Coupon</DialogTitle>
              <DialogDescription>Select a coupon to assign to {c.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
              {availableCoupons.length === 0 ? (
                <p className="text-sm text-charcoal-lighter text-center py-4">No active coupons available</p>
              ) : availableCoupons.map((coupon) => (
                <button
                  key={coupon.id}
                  type="button"
                  onClick={() => setSelectedCouponId(coupon.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                    selectedCouponId === coupon.id ? "border-secondary bg-secondary/5" : "border-border/30 hover:bg-pearl/50"
                  )}
                >
                  <div>
                    <p className="text-xs font-semibold text-charcoal">{coupon.code}</p>
                    <p className="text-[9px] text-charcoal-lighter">{coupon.description || `${coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value)} off`}</p>
                  </div>
                  <Badge className="text-[9px]">{coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value)}</Badge>
                </button>
              ))}
            </div>
            <DialogFooter>
              <button onClick={() => setCouponDialogOpen(false)} className="px-4 py-2 text-xs text-charcoal-lighter hover:text-charcoal">Cancel</button>
              <button onClick={handleAssignCoupon} disabled={!selectedCouponId} className="px-4 py-2 rounded-full bg-secondary text-white text-xs font-semibold hover:bg-secondary-dark hover:shadow-[0_6px_25px_rgba(192,57,43,0.3)] hover:-translate-y-[1px] active:scale-[0.96] disabled:opacity-40 transition-all duration-300">
                Assign Coupon
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Customer Dialog */}
        <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-secondary" /> Edit Customer</DialogTitle>
              <DialogDescription>Update customer profile details</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input label="Full Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Input label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              <div className="flex items-center gap-3">
                <Switch checked={editActive} onCheckedChange={setEditActive} />
                <span className="text-sm text-charcoal-lighter">{editActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
            <DialogFooter>
              <button onClick={() => setEditCustomerOpen(false)} className="px-4 py-2 text-xs text-charcoal-lighter hover:text-charcoal">Cancel</button>
              <button onClick={handleSaveCustomer} disabled={editSaving || !editName.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary text-white text-xs font-semibold hover:bg-secondary-dark hover:shadow-[0_6px_25px_rgba(192,57,43,0.3)] hover:-translate-y-[1px] active:scale-[0.96] disabled:opacity-40 transition-all duration-300">
                {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── CUSTOMER LIST ───
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Customers</h1>
          <p className="text-sm text-charcoal-lighter">{activeCustomers.length} registered · {formatCurrency(totalRevenue)} lifetime revenue</p>
        </div>
        <AdminButton variant="outline" size="sm"><Users className="h-3.5 w-3.5" /> Export</AdminButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Customers", value: activeCustomers.length, icon: Users, color: "text-secondary bg-secondary/10" },
          { label: "Total Orders", value: totalOrders, icon: ShoppingCart, color: "text-blue-500 bg-blue-50" },
          { label: "Revenue", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-success bg-success/10" },
          { label: "Avg. LTV", value: formatCurrency(avgLifetimeValue), icon: TrendingUp, color: "text-gold bg-gold/10" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-3 flex items-center gap-2.5">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl shrink-0", s.color)}><s.icon className="h-4 w-4" /></div>
            <div><p className="text-lg font-bold text-charcoal leading-tight">{s.value}</p><p className="text-[9px] text-charcoal-lighter">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="p-3 border-b border-border/20">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Search name, phone, email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4" />} className="flex-1" />
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Bronze">Bronze</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/20 text-left">
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">Customer</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden sm:table-cell">
                  <button onClick={() => toggleSort("orders")} className="flex items-center gap-1 hover:text-charcoal transition-colors">
                    Orders <ArrowUpDown className={cn("h-3 w-3", sortBy === "orders" && "text-secondary")} />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider">
                  <button onClick={() => toggleSort("spent")} className="flex items-center gap-1 hover:text-charcoal transition-colors">
                    Spent <ArrowUpDown className={cn("h-3 w-3", sortBy === "spent" && "text-secondary")} />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Tier</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden lg:table-cell">
                  <button onClick={() => toggleSort("lastOrder")} className="flex items-center gap-1 hover:text-charcoal transition-colors">
                    Last Order <ArrowUpDown className={cn("h-3 w-3", sortBy === "lastOrder" && "text-secondary")} />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden xl:table-cell">
                  <button onClick={() => toggleSort("joined")} className="flex items-center gap-1 hover:text-charcoal transition-colors">
                    Joined <ArrowUpDown className={cn("h-3 w-3", sortBy === "joined" && "text-secondary")} />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-charcoal-lighter uppercase tracking-wider hidden md:table-cell">Status</th>
                <th className="px-4 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-charcoal-lighter">{activeCustomers.length === 0 ? "No customers yet. Customers will appear here when they register or place an order." : "No customers match your search"}</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} onClick={() => handleSelectCustomer(c)} className="border-b border-border/10 hover:bg-pearl/50 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className="text-[10px] font-semibold">{getInitials(c.name)}</AvatarFallback></Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-charcoal text-sm truncate">{c.name}</p>
                          <p className="text-[10px] text-charcoal-lighter">{c.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="font-semibold text-charcoal">{c.totalOrders}</p>
                      <p className="text-[9px] text-charcoal-lighter">{c.totalItems} items</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-charcoal">{formatCurrency(c.totalSpent)}</p>
                      <p className="text-[9px] text-charcoal-lighter">Avg {formatCurrency(c.avgOrderValue)}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge className={cn("text-[9px]", tierColors[c.tier])}>{c.tier}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-charcoal-lighter">
                      {formatDateShort(c.lastOrderDate)}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-xs text-charcoal-lighter">
                      {c.joinedDate ? formatDateShort(c.joinedDate) : "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant={c.isActive ? "success" : "destructive"} className="text-[9px]">{c.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-charcoal-lighter" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
