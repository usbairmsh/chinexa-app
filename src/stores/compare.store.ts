"use client";

import { create } from "zustand";
import { MAX_COMPARE_ITEMS } from "@/lib/constants";

interface CompareState {
  items: string[];
  addItem: (productId: string) => boolean;
  removeItem: (productId: string) => void;
  toggleItem: (productId: string) => boolean;
  isInCompare: (productId: string) => boolean;
  clearCompare: () => void;
}

export const useCompareStore = create<CompareState>()((set, get) => ({
  items: [],

  addItem: (productId) => {
    const state = get();
    if (state.items.length >= MAX_COMPARE_ITEMS) return false;
    if (state.items.includes(productId)) return true;
    set({ items: [...state.items, productId] });
    return true;
  },

  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((id) => id !== productId),
    })),

  toggleItem: (productId) => {
    const state = get();
    if (state.items.includes(productId)) {
      set({ items: state.items.filter((id) => id !== productId) });
      return false;
    }
    if (state.items.length >= MAX_COMPARE_ITEMS) return false;
    set({ items: [...state.items, productId] });
    return true;
  },

  isInCompare: (productId) => get().items.includes(productId),

  clearCompare: () => set({ items: [] }),
}));
