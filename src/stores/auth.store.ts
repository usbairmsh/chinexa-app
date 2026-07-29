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
  /** Set for the id of a user whose cart/wishlist login() has just restored
   *  (via a guest-merge). Lets CartWishlistSync skip its own reload-adopt for
   *  that user so the two don't race on a fresh sign-in. Not persisted. */
  justRestoredUserId: string | null;

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
      justRestoredUserId: null,

      login: (session) => {
        const customerId = session.user?.id ?? null;
        set({
          user: session.user,
          token: session.token,
          isAuthenticated: true,
          // Mark this user as restored-by-login so the sync component skips its
          // reload-adopt for them (prevents a race that could drop a guest merge).
          justRestoredUserId: customerId,
        });
        // Restore this account's server-saved cart & wishlist, merging in any
        // items added while signed out. Makes both follow the account across
        // devices and survive logout (logout clears local; this brings it back).
        // Best-effort — failures leave the local state intact.
        if (customerId) {
          try {
            // Mark the active customer FIRST so loadServer/saveServer guards
            // accept this account's syncs (and reject stale ones after logout).
            useCartStore.getState().setActiveCustomer(customerId);
            useWishlistStore.getState().setActiveCustomer(customerId);
            // merge = true: this is a fresh sign-in, so combine any guest
            // cart/wishlist with the account's server-saved one (once).
            useWishlistStore.getState().loadServer(customerId, true);
            useCartStore.getState().loadServer(customerId, true);
          } catch { /* stores not ready */ }
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          justRestoredUserId: null,
        });
        // Clear the browser-persisted cart & wishlist on logout so the next
        // (or a shared-device) user never inherits the previous account's items.
        // Done in the store itself so EVERY logout path clears them, not just
        // the header button.
        try {
          // Clear the active-customer marker FIRST so any in-flight/debounced
          // save or load for the old account is rejected by the store guards
          // (prevents an empty-cart PUT wiping the server copy after logout).
          useCartStore.getState().setActiveCustomer(null);
          useWishlistStore.getState().setActiveCustomer(null);
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
      // Persist only the identity fields. justRestoredUserId is a transient,
      // in-session-only marker — persisting it would make a page reload look
      // like a fresh login and skip the reload-adopt it needs.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
