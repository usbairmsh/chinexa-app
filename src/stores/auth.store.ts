"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Session } from "@/types/auth";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (session: Session) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (session) =>
        set({
          user: session.user,
          token: session.token,
          isAuthenticated: true,
        }),

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        // Clear the browser-persisted cart & wishlist on logout so the next
        // (or a shared-device) user never inherits the previous account's items.
        // Done in the store itself so EVERY logout path clears them, not just
        // the header button.
        try {
          useCartStore.getState().clearCart();
          useWishlistStore.getState().clearWishlist();
        } catch { /* stores not ready — nothing to clear */ }
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: "chinexa-auth",
    }
  )
);
