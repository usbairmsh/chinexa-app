"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";

/**
 * Keeps a logged-in customer's cart & wishlist in sync with the server so they
 * follow the account across devices and survive logout.
 *
 * - On (re)load while already authenticated (auth is persisted in localStorage,
 *   so a returning visitor is logged in before login() ever runs this session),
 *   restore the server cart/wishlist once — merging any guest items in.
 * - While authenticated, debounce-save the cart to the server whenever it
 *   changes (wishlist items already mirror per-toggle via syncServer at the
 *   call sites; loadServer covers the initial union).
 *
 * Mounted once in the storefront layout.
 */
export function CartWishlistSync() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const restoredForRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore once per logged-in customer (covers page reloads where auth is
  // already hydrated; login() handles the fresh-sign-in case). Reset when the
  // account changes or the user logs out so the next login restores again.
  useEffect(() => {
    if (!userId) {
      restoredForRef.current = null;
      return;
    }
    if (restoredForRef.current === userId) return;
    restoredForRef.current = userId;
    useWishlistStore.getState().loadServer(userId);
    useCartStore.getState().loadServer(userId);
  }, [userId]);

  // Debounce-save the cart whenever its items/coupon change, but only while
  // logged in. Subscribes to just the persisted slices to avoid saving on
  // derived-getter churn.
  useEffect(() => {
    if (!userId) return;
    const unsub = useCartStore.subscribe((state, prev) => {
      if (state.items === prev.items && state.couponCode === prev.couponCode) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        useCartStore.getState().saveServer(userId);
      }, 800);
    });
    return () => {
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [userId]);

  return null;
}
