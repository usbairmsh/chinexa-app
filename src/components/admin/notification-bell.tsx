"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Send, Tag, Gift, Package, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDateShort, cn } from "@/lib/utils";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  audience_detail: string | null;
  recipient_count: number;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  promo: { icon: Tag, color: "bg-pink-50 text-pink-600" },
  loyalty: { icon: Gift, color: "bg-amber-50 text-amber-600" },
  order: { icon: Package, color: "bg-blue-50 text-blue-600" },
  system: { icon: Bell, color: "bg-pearl text-charcoal-lighter" },
};

/** Admin header bell — popup with recent broadcasts + quick link to the composer. */
export function AdminNotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
      fetch("/api/notifications/send")
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setBroadcasts(data.slice(0, 6)); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 text-charcoal-lighter hover:text-charcoal transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <p className="text-sm font-semibold text-charcoal">Recent Broadcasts</p>
              <button
                onClick={() => { setOpen(false); router.push("/admin/notifications"); }}
                className="flex items-center gap-1 text-[11px] font-medium text-secondary hover:text-secondary-dark transition-colors"
              >
                <Send className="h-3 w-3" /> Send new
              </button>
            </div>

            <div className="max-h-[340px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-charcoal-lighter">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : broadcasts.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Bell className="h-8 w-8 text-charcoal-lighter/30 mx-auto mb-2" />
                  <p className="text-xs text-charcoal-lighter">No notifications sent yet.</p>
                </div>
              ) : (
                broadcasts.map((b) => {
                  const config = typeConfig[b.type] || typeConfig.system;
                  const Icon = config.icon;
                  return (
                    <div key={b.id} className="flex gap-3 px-4 py-3 border-b border-border/10 last:border-0">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-charcoal truncate">{b.title}</p>
                        <p className="text-[11px] text-charcoal-lighter line-clamp-1 mt-0.5">{b.message}</p>
                        <p className="text-[9px] text-charcoal-lighter mt-1">
                          {b.audience_detail || b.audience} · {b.recipient_count} recipient{b.recipient_count !== 1 ? "s" : ""} · {formatDateShort(b.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

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
