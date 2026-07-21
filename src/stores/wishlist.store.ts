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
    }),
    {
      name: "chinexa-wishlist",
    }
  )
);
