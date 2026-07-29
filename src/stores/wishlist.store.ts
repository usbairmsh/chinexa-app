"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  items: string[];
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  toggleItem: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
  /**
   * Mirror a wishlist add/remove to the server for a logged-in customer, so a
   * back-in-stock notification can be sent when an out-of-stock item returns.
   * Best-effort; no-op (resolves false) when there's no customerId. Returns
   * whether the product was out of stock (server-authoritative) so the caller
   * can show the "we'll notify you" popup.
   */
  syncServer: (productId: string, added: boolean, customerId?: string | null) => Promise<{ outOfStock: boolean }>;
  /**
   * On login: pull the customer's server-side wishlist and MERGE any local
   * (guest) items into it — union of both, then push any local-only items up to
   * the server so nothing is lost. Makes the wishlist follow the account across
   * devices / survive logout. No-op without a customerId.
   */
  loadServer: (customerId: string) => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId) =>
        set((state) => ({
          items: state.items.includes(productId)
            ? state.items
            : [...state.items, productId],
        })),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((id) => id !== productId),
        })),

      toggleItem: (productId) =>
        set((state) => ({
          items: state.items.includes(productId)
            ? state.items.filter((id) => id !== productId)
            : [...state.items, productId],
        })),

      isInWishlist: (productId) => get().items.includes(productId),

      clearWishlist: () => set({ items: [] }),

      syncServer: async (productId, added, customerId) => {
        if (!customerId) return { outOfStock: false };
        try {
          if (added) {
            const res = await fetch("/api/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ customer_id: customerId, product_id: productId }),
            });
            if (!res.ok) return { outOfStock: false };
            const data = await res.json();
            return { outOfStock: !!data.out_of_stock };
          } else {
            await fetch(`/api/wishlist?customer_id=${encodeURIComponent(customerId)}&product_id=${encodeURIComponent(productId)}`, { method: "DELETE" });
            return { outOfStock: false };
          }
        } catch {
          return { outOfStock: false };
        }
      },

      loadServer: async (customerId) => {
        if (!customerId) return;
        try {
          const localBefore = get().items;
          const res = await fetch(`/api/wishlist?customer_id=${encodeURIComponent(customerId)}`);
          if (!res.ok) return;
          const rows = (await res.json()) as { product_id: string }[];
          const serverIds = Array.isArray(rows) ? rows.map((r) => r.product_id) : [];
          // Union: keep everything the account has on the server PLUS anything the
          // user added as a guest before logging in.
          const merged = Array.from(new Set([...serverIds, ...localBefore]));
          set({ items: merged });
          // Push any local-only (guest) items up to the server so they persist
          // for next time / other devices. Best-effort, fire-and-forget.
          const localOnly = localBefore.filter((id) => !serverIds.includes(id));
          for (const productId of localOnly) {
            fetch("/api/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ customer_id: customerId, product_id: productId }),
            }).catch(() => {});
          }
        } catch {
          // Network error — keep whatever's local; try again on next login.
        }
      },
    }),
    {
      name: "chinexa-wishlist",
    }
  )
);
