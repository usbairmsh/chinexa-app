"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Header notification bell. Shows the unread count for the signed-in customer
 * (polled every 60s and on route change); guests are sent to the login page.
 */
export function NotificationBell() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  return (
    <Link
      href={isAuthenticated ? "/dashboard/notifications" : "/login"}
      className="relative flex items-center justify-center h-9 w-9 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-primary-light transition-all"
      aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
    >
      <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
      {mounted && isAuthenticated && unread > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-0 right-0 sm:top-0.5 sm:right-0.5 flex h-[14px] min-w-[14px] px-0.5 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-white ring-2 ring-white"
        >
          {unread > 99 ? "99+" : unread}
        </motion.span>
      )}
    </Link>
  );
}
