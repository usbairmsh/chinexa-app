"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Package, Tag, Star, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/stores/auth.store";
import { formatDateShort, cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "order" | "promo" | "loyalty" | "system";
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  order: { icon: Package, color: "bg-secondary/10 text-secondary" },
  promo: { icon: Tag, color: "bg-coral-light text-coral" },
  loyalty: { icon: Gift, color: "bg-gold/10 text-gold" },
  system: { icon: Bell, color: "bg-pearl text-charcoal-lighter" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/notifications?customer_id=${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read", customer_id: user.id }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleMarkRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id }),
    });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  // Relative time
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDateShort(dateStr);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/20 p-4 flex gap-3">
            <div className="h-10 w-10 bg-pearl rounded-xl animate-pulse shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-pearl rounded animate-pulse mb-2" />
              <div className="h-3 w-48 bg-pearl rounded animate-pulse mb-1.5" />
              <div className="h-2.5 w-16 bg-pearl rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-xl font-semibold text-charcoal">Notifications</h2>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-charcoal-lighter" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up! Notifications about orders, points, and promotions will appear here." />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif, i) => {
            const config = typeConfig[notif.type] || typeConfig.system;
            const Icon = config.icon;
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className={cn("cursor-pointer", !notif.is_read && "bg-primary-50/50 border-secondary/10")}
                  onClick={() => {
                    if (!notif.is_read) handleMarkRead(notif.id);
                    if (notif.link) router.push(notif.link);
                  }}
                >
                  <CardContent className="p-4 flex gap-3">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm", notif.is_read ? "text-charcoal" : "font-semibold text-charcoal")}>
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <span className="h-2 w-2 rounded-full bg-secondary shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-charcoal-lighter mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-charcoal-lighter mt-1.5">{timeAgo(notif.created_at)}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
