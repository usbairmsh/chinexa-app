"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Package, ShoppingCart, Users, Star, Settings, Shield, FileText, Image as ImageIcon, Tag, Loader2, Activity, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminButton } from "@/components/admin/shared/admin-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateShort, cn } from "@/lib/utils";

interface LogEntry {
  id: number;
  user_name: string;
  user_username?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
  created_at: string;
}

const entityIcons: Record<string, typeof Package> = {
  product: Package,
  order: ShoppingCart,
  customer: Users,
  review: Star,
  settings: Settings,
  coupon: Shield,
  blog: FileText,
  banner: ImageIcon,
  category: Tag,
  stock: Package,
  fraud: Shield,
  membership: Star,
};

const entityColors: Record<string, string> = {
  product: "bg-secondary/10 text-secondary",
  order: "bg-blue-50 text-blue-500",
  customer: "bg-violet-50 text-violet-500",
  review: "bg-gold/10 text-gold",
  settings: "bg-charcoal/5 text-charcoal-lighter",
  coupon: "bg-emerald-50 text-emerald-500",
  blog: "bg-orange-50 text-orange-500",
  banner: "bg-pink-50 text-pink-500",
  category: "bg-cyan-50 text-cyan-500",
  stock: "bg-amber-50 text-amber-600",
  fraud: "bg-red-50 text-red-500",
  membership: "bg-violet-50 text-violet-500",
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(dateStr);
};

export default function AdminActivityLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Debounce the free-text search so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "500" });
      if (filter && filter !== "all") p.set("entity_type", filter);
      if (search) p.set("search", search);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      const res = await fetch(`/api/activity-log?${p.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch {} finally { setLoading(false); }
  }, [filter, search, from, to]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const hasFilters = filter !== "all" || !!search || !!from || !!to;
  const clearFilters = () => { setFilter("all"); setSearchInput(""); setSearch(""); setFrom(""); setTo(""); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-charcoal">Activity Log</h1>
        <p className="text-sm text-charcoal-lighter">
          <span className="font-semibold text-charcoal [font-variant-numeric:tabular-nums]">{logs.length}</span> activities
          {hasFilters ? " matching filters" : ""} · showing the last 30 days
        </p>
      </div>

      {/* Filters: search by admin name/username, access type, and date range */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal-lighter pointer-events-none" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search admin name or username…"
                className="w-full h-11 pl-9 pr-3 rounded-luxury bg-beige-dark/70 shadow-[inset_0_0_0_1px_rgba(58,36,56,0.06)] text-sm text-charcoal placeholder:text-charcoal-lighter/50 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_var(--color-secondary)] focus:outline-none transition-all"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger><SelectValue placeholder="Access type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Access Types</SelectItem>
                <SelectItem value="admin">Admin / Users</SelectItem>
                <SelectItem value="product">Products</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="coupon">Coupons</SelectItem>
                <SelectItem value="banner">Banners</SelectItem>
                <SelectItem value="category">Categories</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
                <SelectItem value="review">Reviews</SelectItem>
                <SelectItem value="fraud">Fraud</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="role">Roles</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" label="From" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="To" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          {hasFilters && (
            <div className="flex justify-end mt-3">
              <AdminButton variant="ghost" size="sm" onClick={clearFilters}><X className="h-3.5 w-3.5 mr-1" /> Clear filters</AdminButton>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Activity} title="No matching activity" description={hasFilters ? "No activities match your filters. Try widening the date range or clearing filters." : "Admin actions from the last 30 days will appear here automatically."} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="relative">
              <div className="absolute left-[39px] top-0 bottom-0 w-px bg-border/50 hidden sm:block" />
              {logs.map((log, index) => {
                const Icon = entityIcons[log.entity_type] || Package;
                const color = entityColors[log.entity_type] || "bg-pearl text-charcoal";

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 20) * 0.03 }}
                    className={cn(
                      "flex items-start gap-4 p-4 hover:bg-pearl/50 transition-colors",
                      index < logs.length - 1 && "border-b border-border/20"
                    )}
                  >
                    <div className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0", color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-charcoal">
                        <span className="font-medium">{log.user_name || "System"}</span>
                        {log.user_username && <span className="text-[11px] text-charcoal-lighter"> @{log.user_username}</span>}
                        {" "}
                        <span className="text-charcoal-lighter">{log.action}</span>
                        {log.details && (
                          <>
                            {" "}
                            <span className="font-medium">{log.details}</span>
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-charcoal-lighter">
                        <span>{timeAgo(log.created_at)}</span>
                        <Badge variant="outline" className="text-[9px]">{log.entity_type}</Badge>
                        {log.entity_id && <span className="hidden sm:inline font-mono">{log.entity_id}</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
