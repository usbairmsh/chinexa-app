"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, ShoppingCart, Users, Star, Settings, Shield, FileText, Image as ImageIcon, Tag, Loader2, Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateShort, cn } from "@/lib/utils";

interface LogEntry {
  id: number;
  user_name: string;
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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter && filter !== "all"
        ? `/api/activity-log?limit=50&entity_type=${filter}`
        : "/api/activity-log?limit=50";
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch {} finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilterChange = (value: string) => {
    setFilter(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Activity Log</h1>
          <p className="text-sm text-charcoal-lighter">{logs.length} recent activities</p>
        </div>
        <Select value={filter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
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
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description={filter !== "all" ? `No ${filter} activities found.` : "Admin actions will be recorded here automatically."} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="relative">
              <div className="absolute left-[39px] top-0 bottom-0 w-px bg-border/50 hidden sm:block" />
              {logs.map((log, index) => {
                const Icon = entityIcons[log.entity_type] || Package;
                const color = entityColors[log.entity_type] || "bg-pearl text-charcoal";

                return (
                  <div
                    key={log.id}
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
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
