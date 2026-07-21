"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Bell, X } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";

// Global popup shown when a shopper adds an OUT-OF-STOCK item to their wishlist:
// confirms the add and explains they'll be notified when it's restocked.
// Triggered from anywhere via useUIStore().showBackInStockToast(productName).
export function BackInStockToast() {
  const message = useUIStore((s) => s.backInStockToast);
  const hide = useUIStore((s) => s.hideBackInStockToast);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 6000);
    return () => clearTimeout(t);
  }, [message, hide]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-sm sm:left-auto sm:right-6 sm:inset-x-auto"
          role="status"
          aria-live="polite"
        >
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_16px_50px_rgba(58,36,56,0.22)] border border-border/40 p-4 pr-9">
            <button
              onClick={hide}
              className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full text-charcoal-lighter hover:bg-pearl hover:text-charcoal transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/10">
                <Heart className="h-4 w-4 text-secondary fill-secondary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-charcoal">Added to your wishlist</p>
                <p className="mt-0.5 text-xs text-charcoal-lighter leading-relaxed">
                  <span className="font-medium text-charcoal">{message}</span> is out of stock. We&apos;ll notify you the moment it&apos;s back — please check again later.
                </p>
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-secondary">
                  <Bell className="h-3 w-3" /> Restock notification on
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
