"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Package, Tag, Gift, CheckCheck, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/auth.store";
import { formatDateShort, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIconPlay } from "@/hooks/use-icon-play";

interface Notification {
  id: string;
  type: "order" | "promo" | "loyalty" | "system";
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  order: { icon: Package, color: "bg-secondary/10 text-secondary" },
  promo: { icon: Tag, color: "bg-coral-light text-coral" },
  loyalty: { icon: Gift, color: "bg-gold/10 text-gold" },
  system: { icon: Bell, color: "bg-pearl text-charcoal-lighter" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (!Number.isFinite(diff) || diff < 0) return formatDateShort(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateShort(dateStr);
}

/**
 * Renders children into document.body when active — used for the mobile
 * bottom sheet, because the header's backdrop-blur creates a containing
 * block that would trap `position: fixed` descendants.
 */
function MaybePortal({ active, children }: { active: boolean; children: React.ReactNode }) {
  if (!active || typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}

/**
 * Header notification bell with a popup inbox. Rendered as a plain button so
 * the server and first client render are identical (no hydration mismatch).
 * Guests are sent to login; signed-in customers get the dropdown.
 */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const storeAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mounted, setMounted] = useState(false);
  const isAuthenticated = mounted && storeAuthenticated;

  const [open, setOpen] = useState(false);
  // On phones the panel renders as a bottom sheet via a portal — the header's
  // backdrop-blur would otherwise become the containing block for `fixed`.
  const [useSheet, setUseSheet] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const bellIcon = useIconPlay<HTMLButtonElement>();

  useEffect(() => setMounted(true), []);

  // Unread badge — poll every 60s and on route change
  const fetchCount = useCallback(async () => {
    if (!user?.id) { setUnread(0); return; }
    try {
      const res = await fetch(`/api/notifications?customer_id=${user.id}&count_only=1`);
      const data = await res.json();
      if (res.ok && Number.isFinite(Number(data?.unread))) setUnread(Number(data.unread));
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [fetchCount, pathname]);

  // Close popup on route change / outside click / Escape
  useEffect(() => { setOpen(false); }, [pathname]);

  // On phones the panel is a bottom sheet — lock page scroll while it's open
  useEffect(() => {
    if (open && typeof window !== "undefined" && window.innerWidth < 640) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // The sheet may live in a portal outside panelRef — check both containers
      if (panelRef.current?.contains(target) || sheetRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const fetchList = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?customer_id=${user.id}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setItems(data.slice(0, 8));
    } catch {} finally { setLoading(false); }
  }, [user?.id]);

  const handleBellClick = () => {
    if (!isAuthenticated) { router.push("/login"); return; }
    const next = !open;
    if (next) setUseSheet(window.innerWidth < 640);
    setOpen(next);
    if (next) fetchList();
  };

  const handleItemClick = async (notif: Notification) => {
    if (!notif.is_read) {
      setItems((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id: notif.id }),
      }).catch(() => {});
    }
    setOpen(false);
    // Show the message in a modal instead of navigating straight to `link` —
    // some stored links are stale/invalid (admin-typed or from removed
    // routes) and would 404. The link, when present, becomes an optional
    // "View" action inside the modal instead of an automatic redirect.
    setSelected(notif);
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read", customer_id: user.id }),
    }).catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell literally rings — a quick side-to-side wiggle around the top pivot, like a clapper
          striking, rather than a generic scale/rotate. Played imperatively via animate() so leaving
          mid-wiggle always finishes back to rotate 0 instead of whileHover snapping it stuck. */}
      <motion.button
        ref={bellIcon.scope}
        onClick={handleBellClick}
        onHoverStart={() => bellIcon.play({ rotate: [0, 14, -12, 9, -6, 3, 0] }, 0.55)}
        whileTap={{ scale: 0.92 }}
        style={{ transformOrigin: "top center" }}
        className="relative flex items-center justify-center h-9 w-9 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-primary-light transition-colors"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      >
        <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        <AnimatePresence>
          {isAuthenticated && unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 12 }}
              className="absolute top-0 right-0 sm:top-0.5 sm:right-0.5 flex h-[14px] min-w-[14px] px-0.5 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-white ring-2 ring-white"
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Popup — bottom sheet on phones (portaled to body), anchored dropdown on ≥sm */}
      <MaybePortal active={useSheet}>
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-charcoal/40 backdrop-blur-[2px] sm:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              ref={sheetRef}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-border/20 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-h-[480px] sm:rounded-2xl sm:border sm:shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:overflow-hidden"
            >
            {/* Drag handle — mobile sheet only */}
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-border/20">
              <p className="text-sm font-semibold text-charcoal flex items-center gap-2">
                Notifications
                {unread > 0 && (
                  <span className="text-[10px] font-bold bg-secondary text-white px-1.5 py-0.5 rounded-full">{unread}</span>
                )}
              </p>
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] text-charcoal-lighter hover:text-secondary transition-colors"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain sm:max-h-[360px]">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-charcoal-lighter">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Bell className="h-8 w-8 text-charcoal-lighter/30 mx-auto mb-2" />
                  <p className="text-xs text-charcoal-lighter">You&apos;re all caught up!</p>
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

            {/* Footer — extra bottom padding on phones for the home-indicator area */}
            <button
              onClick={() => { setOpen(false); router.push("/dashboard/notifications"); }}
              className="w-full shrink-0 flex items-center justify-center gap-1.5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-2.5 text-xs font-medium text-secondary hover:bg-primary-light transition-colors border-t border-border/20"
            >
              View all notifications <ArrowRight className="h-3 w-3" />
            </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </MaybePortal>

      {/* Notification detail modal — replaces the old direct router.push(link),
          which 404'd whenever a stored link was stale/invalid. */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          {selected && (() => {
            const config = typeConfig[selected.type] || typeConfig.system;
            const Icon = config.icon;
            return (
              <>
                <DialogHeader>
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl mb-2", config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <DialogTitle>{selected.title}</DialogTitle>
                  <DialogDescription>{timeAgo(selected.created_at)}</DialogDescription>
                </DialogHeader>
                <p className="text-sm text-charcoal-light whitespace-pre-wrap">{selected.message}</p>
                {selected.link && (
                  <DialogFooter>
                    <Button
                      variant="secondary"
                      onClick={() => { const link = selected.link!; setSelected(null); router.push(link); }}
                    >
                      View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </DialogFooter>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
