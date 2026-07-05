"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Send, Package, RotateCcw, Star, AlertTriangle, UserPlus, Warehouse, Loader2, CheckCheck, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDateShort, cn } from "@/lib/utils";

interface AdminNotification {
  id: string;
  type: "order" | "return" | "review" | "stock" | "fraud" | "customer" | "system";
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  order: { icon: Package, color: "bg-secondary/10 text-secondary" },
  return: { icon: RotateCcw, color: "bg-amber-50 text-amber-600" },
  review: { icon: Star, color: "bg-violet-50 text-violet-600" },
  stock: { icon: Warehouse, color: "bg-orange-50 text-orange-600" },
  fraud: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
  customer: { icon: UserPlus, color: "bg-blue-50 text-blue-600" },
  system: { icon: Bell, color: "bg-pearl text-charcoal-lighter" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diff) || diff < 0) return formatDateShort(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(dateStr);
}

/**
 * Admin header bell — popup inbox of incoming store events:
 * new orders, return requests, pending reviews, low stock, fraud alerts,
 * and new customer registrations.
 */
export function AdminNotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Unread badge — poll every 45s and on route change
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/admin?count_only=1");
      const data = await res.json();
      if (res.ok && Number.isFinite(Number(data?.unread))) setUnread(Number(data.unread));
    } catch {}
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 45000);
    return () => clearInterval(interval);
  }, [fetchCount, pathname]);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      fetch("/api/notifications/admin")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setItems(data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };

  const handleItemClick = (notif: AdminNotification) => {
    if (!notif.is_read) {
      setItems((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      fetch("/api/notifications/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id: notif.id }),
      }).catch(() => {});
    }
    setOpen(false);
    if (notif.link) router.push(notif.link);
  };

  const handleMarkAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    fetch("/api/notifications/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    }).catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 text-charcoal-lighter hover:text-charcoal transition-colors"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0.5 right-0.5 flex h-[15px] min-w-[15px] px-0.5 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-white ring-2 ring-white"
          >
            {unread > 99 ? "99+" : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96 rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-border/20 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <p className="text-sm font-semibold text-charcoal flex items-center gap-2">
                Notifications
                {unread > 0 && (
                  <span className="text-[10px] font-bold bg-secondary text-white px-1.5 py-0.5 rounded-full">{unread}</span>
                )}
              </p>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] text-charcoal-lighter hover:text-secondary transition-colors"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => { setOpen(false); router.push("/admin/notifications"); }}
                  className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-secondary-dark transition-colors"
                  title="Send push notification to customers"
                >
                  <Send className="h-3 w-3" /> Send
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-charcoal-lighter">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Bell className="h-8 w-8 text-charcoal-lighter/30 mx-auto mb-2" />
                  <p className="text-xs text-charcoal-lighter">No notifications yet.</p>
                  <p className="text-[10px] text-charcoal-lighter mt-1">New orders, returns, reviews, low stock and fraud alerts will appear here.</p>
                </div>
              ) : (
                items.map((notif) => {
                  const config = typeConfig[notif.type] || typeConfig.system;
                  const Icon = config.icon;
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleItemClick(notif)}
                      className={cn(
                        "w-full flex gap-3 px-4 py-3 text-left hover:bg-pearl/60 transition-colors border-b border-border/10 last:border-0",
                        !notif.is_read && "bg-primary-light/40"
                      )}
                    >
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-xs text-charcoal truncate", !notif.is_read && "font-semibold")}>{notif.title}</p>
                          {!notif.is_read && <span className="h-1.5 w-1.5 rounded-full bg-secondary shrink-0 mt-1" />}
                        </div>
                        <p className="text-[11px] text-charcoal-lighter line-clamp-2 mt-0.5">{notif.message}</p>
                        <p className="text-[9px] text-charcoal-lighter mt-1">{timeAgo(notif.created_at)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <button
              onClick={() => { setOpen(false); router.push("/admin/notifications"); }}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-secondary hover:bg-primary-light transition-colors border-t border-border/20"
            >
              Open notification center <ArrowRight className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
