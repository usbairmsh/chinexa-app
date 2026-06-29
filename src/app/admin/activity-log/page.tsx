"use client";

import { useState, useEffect } from "react";
import { Package, ShoppingCart, Users, Star, Settings, Shield, FileText, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const activityLogs = [
  { id: "log-1", user: "Admin", action: "Updated product", entity: "CosRX Vitamin C Brightening Serum", entity_type: "product", timestamp: "Jun 28, 2026 — 2:45 PM", ip: "103.12.45.67" },
  { id: "log-2", user: "Admin", action: "Approved review", entity: "Review #r5 by Tamanna Akter", entity_type: "review", timestamp: "Jun 28, 2026 — 2:30 PM", ip: "103.12.45.67" },
  { id: "log-3", user: "Admin", action: "Updated order status to shipped", entity: "Order #ORD-0525", entity_type: "order", timestamp: "Jun 28, 2026 — 1:15 PM", ip: "103.12.45.67" },
  { id: "log-4", user: "Admin", action: "Created coupon", entity: "SUMMER30", entity_type: "coupon", timestamp: "Jun 28, 2026 — 11:00 AM", ip: "103.12.45.67" },
  { id: "log-5", user: "Admin", action: "Updated banner", entity: "Summer Glow Collection", entity_type: "banner", timestamp: "Jun 27, 2026 — 4:20 PM", ip: "103.12.45.67" },
  { id: "log-6", user: "Admin", action: "Created product", entity: "New Korean Sheet Mask Set", entity_type: "product", timestamp: "Jun 27, 2026 — 3:45 PM", ip: "103.12.45.67" },
  { id: "log-7", user: "Admin", action: "Updated order status to delivered", entity: "Order #ORD-0520", entity_type: "order", timestamp: "Jun 27, 2026 — 2:00 PM", ip: "103.12.45.67" },
  { id: "log-8", user: "Admin", action: "Blocked customer", entity: "Test Account", entity_type: "customer", timestamp: "Jun 27, 2026 — 11:30 AM", ip: "103.12.45.67" },
  { id: "log-9", user: "Admin", action: "Updated SEO settings", entity: "Global meta tags", entity_type: "settings", timestamp: "Jun 26, 2026 — 5:15 PM", ip: "103.12.45.67" },
  { id: "log-10", user: "Admin", action: "Published blog post", entity: "The Ultimate Guide to Korean Skincare", entity_type: "blog", timestamp: "Jun 26, 2026 — 3:00 PM", ip: "103.12.45.67" },
  { id: "log-11", user: "Admin", action: "Deleted product", entity: "Discontinued Lip Balm", entity_type: "product", timestamp: "Jun 26, 2026 — 1:45 PM", ip: "103.12.45.67" },
  { id: "log-12", user: "Admin", action: "Updated shipping rates", entity: "Outside Dhaka zone", entity_type: "settings", timestamp: "Jun 25, 2026 — 4:30 PM", ip: "103.12.45.67" },
  { id: "log-13", user: "Admin", action: "Processed refund", entity: "Order #ORD-0518", entity_type: "order", timestamp: "Jun 25, 2026 — 2:15 PM", ip: "103.12.45.67" },
  { id: "log-14", user: "Admin", action: "Updated category", entity: "Premium Skincare", entity_type: "category", timestamp: "Jun 25, 2026 — 11:00 AM", ip: "103.12.45.67" },
  { id: "log-15", user: "Admin", action: "Replied to review", entity: "Review #r2 by Ayesha Rahman", entity_type: "review", timestamp: "Jun 24, 2026 — 3:30 PM", ip: "103.12.45.67" },
];

const entityIcons: Record<string, typeof Package> = {
  product: Package,
  order: ShoppingCart,
  customer: Users,
  review: Star,
  settings: Settings,
  coupon: Shield,
  blog: FileText,
  banner: ImageIcon,
  category: Package,
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
};

export default function AdminActivityLogPage() {
  const [dbLogs, setDbLogs] = useState<typeof activityLogs>([]);

  useEffect(() => {
    fetch("/api/activity-log?limit=30")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDbLogs(data.map((log: Record<string, unknown>) => ({
            id: `log-${log.id}`,
            user: (log.user_name as string) || "Admin",
            action: (log.action as string) || "",
            entity: (log.details as string) || (log.entity_id as string) || "",
            entity_type: (log.entity_type as string) || "product",
            timestamp: (log.created_at as string) || new Date().toISOString(),
            ip: (log.ip_address as string) || "",
          })));
        }
      })
      .catch(() => {});
  }, []);

  const logs = dbLogs.length > 0 ? dbLogs : activityLogs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">Activity Log</h1>
          <p className="text-sm text-charcoal-lighter">Track all admin actions and changes</p>
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="product">Products</SelectItem>
            <SelectItem value="order">Orders</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="review">Reviews</SelectItem>
            <SelectItem value="settings">Settings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[39px] top-0 bottom-0 w-px bg-border/50 hidden sm:block" />

            {logs.map((log, index) => {
              const Icon = entityIcons[log.entity_type] || Package;
              const color = entityColors[log.entity_type] || "bg-pearl text-charcoal";

              return (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start gap-4 p-4 hover:bg-pearl/50 transition-colors",
                    index < activityLogs.length - 1 && "border-b border-border/20"
                  )}
                >
                  <div className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0", color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-charcoal">
                      <span className="font-medium">{log.user}</span>
                      {" "}
                      <span className="text-charcoal-lighter">{log.action}</span>
                      {" "}
                      <span className="font-medium">{log.entity}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-charcoal-lighter">
                      <span>{log.timestamp}</span>
                      <span className="hidden sm:inline">IP: {log.ip}</span>
                      <Badge variant="outline" className="text-[9px]">{log.entity_type}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
