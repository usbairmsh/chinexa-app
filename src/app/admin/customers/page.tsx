"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, DollarSign, ShoppingCart, TrendingUp, ArrowUpDown,
  ChevronRight, MoreHorizontal, Eye, Mail, Phone, Ban, Star,
  MapPin, Package, Clock, CheckCircle2, Truck, XCircle, Calendar,
  ArrowLeft, X, Filter, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { formatCurrency, formatDateShort, getInitials, cn } from "@/lib/utils";

// ─── RICH DEMO DATA ────────────────────────────────────────
interface CustomerOrder {
  id: string; date: string; total: number; items: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "on_delivery" | "received" | "not_received";
  products: { name: string; image: string; qty: number; price: number }[];
}

interface Customer {
  id: string; name: string; email: string; phone: string; avatar?: string;
  division: string; district: string; address: string;
  totalOrders: number; totalSpent: number; totalItems: number;
  avgOrderValue: number; lastOrderDate: string; joinedDate: string;
  isActive: boolean; tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  orders: CustomerOrder[];
}

// All customer data comes from /api/customers — no mock fallback
const _mockCustomersRemoved = [
  {
    id: "placeholder", name: "", email: "", phone: "",
    division: "", district: "", address: "",
    totalOrders: 18, totalSpent: 156800, totalItems: 42, avgOrderValue: 8711, lastOrderDate: "2026-06-28", joinedDate: "2025-08-15",
    isActive: true, tier: "Platinum",
    orders: [
      { id: "ORD-0527", date: "2026-06-28", total: 8500, items: 2, status: "processing", products: [
        { name: "CosRX Vitamin C Serum", image: "https://picsum.photos/seed/cp1/80/80", qty: 1, price: 3200 },
        { name: "Laneige Water Sleeping Mask", image: "https://picsum.photos/seed/cp2/80/80", qty: 1, price: 4500 },
      ]},
      { id: "ORD-0519", date: "2026-06-20", total: 12400, items: 3, status: "received", products: [
        { name: "Aria Leather Tote", image: "https://picsum.photos/seed/cp3/80/80", qty: 1, price: 8900 },
        { name: "Aurora Pendant Necklace", image: "https://picsum.photos/seed/cp4/80/80", qty: 1, price: 2500 },
        { name: "Cherry Blossom Body Mist", image: "https://picsum.photos/seed/cp5/80/80", qty: 1, price: 1800 },
      ]},
      { id: "ORD-0505", date: "2026-06-10", total: 18900, items: 4, status: "received", products: [
        { name: "Midnight Rose EDP 100ml", image: "https://picsum.photos/seed/cp6/80/80", qty: 1, price: 8500 },
        { name: "Grace Ballet Flat", image: "https://picsum.photos/seed/cp7/80/80", qty: 1, price: 6200 },
        { name: "Bloom Drop Earrings", image: "https://picsum.photos/seed/cp8/80/80", qty: 1, price: 3200 },
        { name: "Green Tea Foam Cleanser", image: "https://picsum.photos/seed/cp9/80/80", qty: 1, price: 1000 },
      ]},
      { id: "ORD-0489", date: "2026-05-28", total: 6200, items: 2, status: "received", products: [
        { name: "Innisfree Green Tea Serum", image: "https://picsum.photos/seed/cp10/80/80", qty: 1, price: 3800 },
        { name: "Sheet Mask Pack", image: "https://picsum.photos/seed/cp11/80/80", qty: 1, price: 1200 },
      ]},
    ],
  },
  {
    id: "c2", name: "Ayesha Rahman", email: "ayesha@email.com", phone: "+880181234567",
    division: "Dhaka", district: "Dhaka", address: "Flat 4B, Navana Tower, Gulshan Avenue",
    totalOrders: 11, totalSpent: 89500, totalItems: 28, avgOrderValue: 8136, lastOrderDate: "2026-06-26", joinedDate: "2025-10-02",
    isActive: true, tier: "Gold",
    orders: [
      { id: "ORD-0526", date: "2026-06-28", total: 12400, items: 3, status: "confirmed", products: [{ name: "Belle Crossbody", image: "https://picsum.photos/seed/cp12/80/80", qty: 1, price: 7200 }, { name: "Niacinamide Serum", image: "https://picsum.photos/seed/cp13/80/80", qty: 2, price: 2600 }] },
      { id: "ORD-0498", date: "2026-06-05", total: 22100, items: 3, status: "received", products: [{ name: "SK-II Facial Treatment", image: "https://picsum.photos/seed/cp14/80/80", qty: 1, price: 12000 }] },
    ],
  },
  {
    id: "c3", name: "Nusrat Jahan", email: "", phone: "+880191234567",
    division: "Dhaka", district: "Dhaka", address: "House 8, Road 3, Dhanmondi",
    totalOrders: 22, totalSpent: 198400, totalItems: 56, avgOrderValue: 9018, lastOrderDate: "2026-06-27", joinedDate: "2025-06-20",
    isActive: true, tier: "Platinum",
    orders: [
      { id: "ORD-0525", date: "2026-06-27", total: 6200, items: 1, status: "shipped", products: [{ name: "Midnight Rose EDP", image: "https://picsum.photos/seed/cp15/80/80", qty: 1, price: 6200 }] },
    ],
  },
  {
    id: "c4", name: "Sadia Islam", email: "sadia@email.com", phone: "+880161234567",
    division: "Dhaka", district: "Gazipur", address: "Block B, Bashundhara R/A",
    totalOrders: 5, totalSpent: 32500, totalItems: 12, avgOrderValue: 6500, lastOrderDate: "2026-06-27", joinedDate: "2026-01-10",
    isActive: true, tier: "Silver",
    orders: [
      { id: "ORD-0524", date: "2026-06-27", total: 18900, items: 4, status: "received", products: [{ name: "Aria Leather Tote", image: "https://picsum.photos/seed/cp16/80/80", qty: 1, price: 8900 }] },
    ],
  },
  {
    id: "c5", name: "Tamanna Akter", email: "", phone: "+880151234567",
    division: "Dhaka", district: "Dhaka", address: "Mirpur-10",
    totalOrders: 28, totalSpent: 245600, totalItems: 72, avgOrderValue: 8771, lastOrderDate: "2026-06-27", joinedDate: "2025-04-01",
    isActive: true, tier: "Platinum",
    orders: [
      { id: "ORD-0523", date: "2026-06-27", total: 4800, items: 1, status: "pending", products: [{ name: "Retinol Anti-Aging Serum", image: "https://picsum.photos/seed/cp17/80/80", qty: 1, price: 4800 }] },
    ],
  },
  {
    id: "c6", name: "Priya Das", email: "priya@email.com", phone: "+880131234567",
    division: "Dhaka", district: "Dhaka", address: "Uttara Sector 7",
    totalOrders: 7, totalSpent: 52300, totalItems: 18, avgOrderValue: 7471, lastOrderDate: "2026-06-26", joinedDate: "2025-11-05",
    isActive: true, tier: "Gold",
    orders: [
      { id: "ORD-0522", date: "2026-06-26", total: 22100, items: 3, status: "received", products: [{ name: "Velvet Orchid EDT", image: "https://picsum.photos/seed/cp18/80/80", qty: 1, price: 5500 }] },
    ],
  },
  {
    id: "c7", name: "Rima Sultana", email: "", phone: "+880141234567",
    division: "Chittagong", district: "Chittagong", address: "Agrabad, Chittagong",
    totalOrders: 3, totalSpent: 14200, totalItems: 5, avgOrderValue: 4733, lastOrderDate: "2026-06-26", joinedDate: "2026-03-15",
    isActive: false, tier: "Bronze",
    orders: [
      { id: "ORD-0521", date: "2026-06-26", total: 3500, items: 1, status: "not_received", products: [{ name: "Belle Crossbody", image: "https://picsum.photos/seed/cp19/80/80", qty: 1, price: 4200 }] },
    ],
  },
  {
    id: "c8", name: "Nabila Chowdhury", email: "nabila@email.com", phone: "+880171234568",
    division: "Dhaka", district: "Dhaka", address: "Banani DOHS",
    totalOrders: 9, totalSpent: 78400, totalItems: 22, avgOrderValue: 8711, lastOrderDate: "2026-06-25", joinedDate: "2025-09-12",
    isActive: true, tier: "Gold",
    orders: [
      { id: "ORD-0520", date: "2026-06-25", total: 15600, items: 2, status: "received", products: [{ name: "Sulwhasoo First Care", image: "https://picsum.photos/seed/cp20/80/80", qty: 1, price: 12000 }] },
    ],
  },
  {
    id: "c9", name: "Sabrina Islam", email: "", phone: "+880181234568",
    division: "Chittagong", district: "Chittagong", address: "Nasirabad, Chittagong",
    totalOrders: 4, totalSpent: 28600, totalItems: 8, avgOrderValue: 7150, lastOrderDate: "2026-06-25", joinedDate: "2026-02-01",
    isActive: true, tier: "Silver",
    orders: [
      { id: "ORD-0519", date: "2026-06-25", total: 9800, items: 2, status: "shipped", products: [{ name: "Golden Hour EDP", image: "https://picsum.photos/seed/cp21/80/80", qty: 1, price: 5400 }] },
    ],
  },
  {
    id: "c10", name: "Lamia Akter", email: "", phone: "+880191234568",
    division: "Sylhet", district: "Sylhet", address: "Zindabazar, Sylhet",
    totalOrders: 2, totalSpent: 11800, totalItems: 4, avgOrderValue: 5900, lastOrderDate: "2026-06-24", joinedDate: "2026-04-20",
    isActive: true, tier: "Bronze",
    orders: [
      { id: "ORD-0518", date: "2026-06-24", total: 7200, items: 2, status: "not_received", products: [{ name: "Celine Mini Clutch", image: "https://picsum.photos/seed/cp22/80/80", qty: 1, price: 4500 }] },
    ],
  },
];

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

export default function AdminCustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("spent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch customers from DB
  useEffect(() => {
    fetch("/api/customers?page_size=100")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data?.length > 0) {
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
      })
      .catch(() => {});
  }, []);

  // Fetch customer detail with orders when selecting
  const handleSelectCustomer = async (customer: Customer) => {
    setLoadingDetail(true);
    setSelectedCustomer(customer);
    try {
      const res = await fetch(`/api/customers/${customer.id}`);
      const data = await res.json();
      if (data && !data.error) {
        const orders: CustomerOrder[] = (data.orders || []).map((o: Record<string, unknown>) => ({
          id: (o.order_number as string) || (o.id as string),
          date: (o.created_at as string) || "",
          total: Number(o.total),
          items: 0,
          status: (o.status as CustomerOrder["status"]) || "pending",
          products: [],
        }));
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
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCustomer(null)} className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading text-xl font-semibold text-charcoal">{c.name}</h1>
            <p className="text-xs text-charcoal-lighter">Customer since {formatDateShort(c.joinedDate)}</p>
          </div>
          <Badge className={cn("text-[10px]", tierColors[c.tier])}>{c.tier}</Badge>
          <Badge variant={c.isActive ? "success" : "destructive"} className="text-[10px]">{c.isActive ? "Active" : "Inactive"}</Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: Profile + Stats */}
          <div className="space-y-5">
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-col items-center text-center mb-4">
                  <Avatar className="h-16 w-16 mb-3 ring-2 ring-primary-light"><AvatarFallback className="text-xl font-semibold bg-secondary text-white">{getInitials(c.name)}</AvatarFallback></Avatar>
                  <h2 className="font-heading text-lg font-semibold text-charcoal">{c.name}</h2>
                  <Badge className={cn("text-[9px] mt-1", tierColors[c.tier])}>{c.tier} Member</Badge>
                </div>
                <Separator className="my-3" />
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-charcoal-lighter"><Phone className="h-3.5 w-3.5 text-secondary" /> {c.phone}</div>
                  {c.email && <div className="flex items-center gap-2 text-charcoal-lighter"><Mail className="h-3.5 w-3.5 text-secondary" /> {c.email}</div>}
                  <div className="flex items-start gap-2 text-charcoal-lighter"><MapPin className="h-3.5 w-3.5 text-secondary mt-0.5" /> {c.address}</div>
                  <div className="flex items-center gap-2 text-charcoal-lighter"><Calendar className="h-3.5 w-3.5 text-secondary" /> Joined {formatDateShort(c.joinedDate)}</div>
                </div>
              </CardContent>
            </Card>

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
                  <p className="text-base font-bold text-charcoal">{s.value}</p>
                  <p className="text-[9px] text-charcoal-lighter">{s.label}</p>
                </CardContent></Card>
              ))}
            </div>
          </div>

          {/* Right: Order History */}
          <div className="lg:col-span-2">
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
                      {/* Order Header */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-pearl/40">
                        <div className="flex items-center gap-4 text-xs">
                          <div><p className="text-[9px] text-charcoal-lighter uppercase">Order</p><p className="font-semibold text-charcoal">{order.id}</p></div>
                          <div className="hidden sm:block"><p className="text-[9px] text-charcoal-lighter uppercase">Date</p><p className="text-charcoal">{formatDateShort(order.date)}</p></div>
                          <div><p className="text-[9px] text-charcoal-lighter uppercase">Total</p><p className="font-semibold text-charcoal">{formatCurrency(order.total)}</p></div>
                        </div>
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full", sc.color, sc.bg)}>
                          <Icon className="h-3 w-3" /> {sc.label}
                        </span>
                      </div>
                      {/* Order Items */}
                      <div className="px-4 py-3 space-y-2">
                        {order.products.map((p, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-pearl shrink-0">
                              <Image src={p.image} alt={p.name} fill className="object-cover" sizes="40px" />
                            </div>
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
                <tr><td colSpan={8} className="px-4 py-16 text-center text-charcoal-lighter">{activeCustomers.length === 0 ? "No customers yet. Customers will appear here when they place orders." : "No customers match your search"}</td></tr>
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
