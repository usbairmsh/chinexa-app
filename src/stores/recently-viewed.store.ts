"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// Client-only "recently viewed" history — product ids, most-recent first,
// deduped and capped. No login required (localStorage, same "chinexa-*"
// convention as the other stores). Cards are rendered by re-fetching current
// product data via /api/products?ids=..., so price/stock stay fresh and
// deleted products drop out automatically.
const MAX = 12;

interface RecentlyViewedState {
  items: string[];
  addItem: (productId: string) => void;
  clear: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (productId) =>
        set((state) => {
          if (!productId) return state;
          // Move-to-front + dedupe, then cap.
          const next = [productId, ...state.items.filter((id) => id !== productId)].slice(0, MAX);
          return { items: next };
        }),
      clear: () => set({ items: [] }),
    }),
    { name: "chinexa-recently-viewed" },
  ),
);
