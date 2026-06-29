"use client";

import { create } from "zustand";

interface UIState {
  mobileMenuOpen: boolean;
  searchOverlayOpen: boolean;
  cartDrawerOpen: boolean;
  quickViewProductId: string | null;

  setMobileMenuOpen: (open: boolean) => void;
  setSearchOverlayOpen: (open: boolean) => void;
  setCartDrawerOpen: (open: boolean) => void;
  setQuickViewProduct: (productId: string | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  mobileMenuOpen: false,
  searchOverlayOpen: false,
  cartDrawerOpen: false,
  quickViewProductId: null,

  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setSearchOverlayOpen: (open) => set({ searchOverlayOpen: open }),
  setCartDrawerOpen: (open) => set({ cartDrawerOpen: open }),
  setQuickViewProduct: (productId) => set({ quickViewProductId: productId }),
}));
