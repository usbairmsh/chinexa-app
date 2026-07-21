"use client";

import { create } from "zustand";

interface UIState {
  mobileMenuOpen: boolean;
  cartDrawerOpen: boolean;
  quickViewProductId: string | null;
  /** Message for the "added to wishlist — we'll notify you on restock" popup.
   *  null = hidden. Shown when an out-of-stock item is wishlisted. */
  backInStockToast: string | null;

  setMobileMenuOpen: (open: boolean) => void;
  setCartDrawerOpen: (open: boolean) => void;
  setQuickViewProduct: (productId: string | null) => void;
  showBackInStockToast: (productName: string) => void;
  hideBackInStockToast: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  mobileMenuOpen: false,
  cartDrawerOpen: false,
  quickViewProductId: null,
  backInStockToast: null,

  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setCartDrawerOpen: (open) => set({ cartDrawerOpen: open }),
  setQuickViewProduct: (productId) => set({ quickViewProductId: productId }),
  showBackInStockToast: (productName) => set({ backInStockToast: productName }),
  hideBackInStockToast: () => set({ backInStockToast: null }),
}));
