"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types/cart";

interface AppliedOffer {
  id: string;
  title: string;
  discount: number;
}

interface OfferLine {
  product_id: string;
  variant_id: string | null;
  discount: number;
  offer_title: string | null;
}

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  couponDiscount: number;
  couponType: "percentage" | "fixed" | null;
  couponValue: number;
  couponMaxDiscount: number | null;

  // Offer state — populated from /api/offers/apply (admin offers section only)
  offerDiscount: number;
  appliedOffers: AppliedOffer[];
  offerLines: OfferLine[];

  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number, type?: "percentage" | "fixed", value?: number, maxDiscount?: number | null) => void;
  removeCoupon: () => void;
  /** Re-evaluate active admin offers against the current cart (server-authoritative). */
  refreshOffers: (customerId?: string | null) => Promise<void>;

  getSubtotal: () => number;
  getShipping: () => number;
  getDiscount: () => number;
  getSavings: () => number;
  getItemSavings: () => { name: string; saved: number }[];
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      couponDiscount: 0,
      couponType: null,
      couponValue: 0,
      couponMaxDiscount: null,
      offerDiscount: 0,
      appliedOffers: [],
      offerLines: [],

      addItem: (item) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.product_id === item.product_id && i.variant_id === item.variant_id
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product_id === item.product_id && i.variant_id === item.variant_id
                  ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.stock) }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, id: `cart-${Date.now()}` }] };
        });
        get().refreshOffers();
      },

      removeItem: (id) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
        get().refreshOffers();
      },

      updateQuantity: (id, quantity) => {
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.id !== id)
            : state.items.map((i) =>
                i.id === id ? { ...i, quantity: Math.min(quantity, i.stock) } : i
              ),
        }));
        get().refreshOffers();
      },

      clearCart: () => set({
        items: [], couponCode: null, couponDiscount: 0, couponType: null, couponValue: 0, couponMaxDiscount: null,
        offerDiscount: 0, appliedOffers: [], offerLines: [],
      }),

      applyCoupon: (code, discount, type, value, maxDiscount) =>
        set({
          couponCode: code,
          couponDiscount: discount,
          couponType: type || "fixed",
          couponValue: value || discount,
          couponMaxDiscount: maxDiscount ?? null,
        }),

      removeCoupon: () => set({ couponCode: null, couponDiscount: 0, couponType: null, couponValue: 0, couponMaxDiscount: null }),

      refreshOffers: async (customerId) => {
        const items = get().items;
        if (items.length === 0) {
          set({ offerDiscount: 0, appliedOffers: [], offerLines: [] });
          return;
        }
        try {
          const res = await fetch("/api/offers/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: customerId || null,
              items: items.map((i) => ({
                product_id: i.product_id,
                variant_id: i.variant_id || null,
                price: i.price,
                quantity: i.quantity,
              })),
            }),
          });
          if (!res.ok) return;
          const data = await res.json();
          set({
            offerDiscount: Number(data.total_discount) || 0,
            appliedOffers: Array.isArray(data.offers) ? data.offers : [],
            offerLines: Array.isArray(data.lines)
              ? data.lines.map((l: OfferLine) => ({
                  product_id: l.product_id,
                  variant_id: l.variant_id ?? null,
                  discount: Number(l.discount) || 0,
                  offer_title: l.offer_title ?? null,
                }))
              : [],
          });
        } catch {
          // Network error — leave last known offer state untouched
        }
      },

      getSubtotal: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getShipping: () => {
        const subtotal = get().getSubtotal();
        if (subtotal === 0) return 0;
        try {
          const stored = typeof window !== "undefined" ? localStorage.getItem("chinexa-delivery") : null;
          if (stored) {
            const delivery = JSON.parse(stored)?.state;
            if (delivery?.freeDeliveryEnabled && subtotal >= delivery.freeDeliveryThreshold) return 0;
            const dhakaZone = delivery?.zones?.find((z: { id: string; charge: number }) => z.id === "dhaka-city");
            return dhakaZone?.charge || 60;
          }
        } catch {}
        return subtotal >= 3000 ? 0 : 60;
      },

      // Offer savings from the admin offers section (not compare_at_price).
      getSavings: () => get().offerDiscount,

      getItemSavings: () =>
        get().offerLines
          .filter((l) => l.discount > 0)
          .map((l) => {
            const item = get().items.find((i) => i.product_id === l.product_id && (i.variant_id || null) === l.variant_id);
            return {
              name: `${item?.product_name || "Item"}${l.offer_title ? ` — ${l.offer_title}` : ""}`,
              saved: l.discount,
            };
          }),

      // Coupon discount, recalculated dynamically against the offer-discounted subtotal.
      getDiscount: () => {
        const state = get();
        if (!state.couponCode) return 0;
        const discountedSubtotal = Math.max(0, state.getSubtotal() - state.offerDiscount);
        if (state.couponType === "percentage") {
          let discount = (discountedSubtotal * state.couponValue) / 100;
          if (state.couponMaxDiscount) discount = Math.min(discount, state.couponMaxDiscount);
          return Math.min(Math.round(discount), discountedSubtotal);
        }
        return Math.min(state.couponDiscount, discountedSubtotal);
      },

      getTotal: () => {
        const state = get();
        const subtotal = state.getSubtotal();
        const shipping = state.getShipping();
        return Math.max(0, subtotal - state.offerDiscount - state.getDiscount() + shipping);
      },

      getItemCount: () =>
        get().items.reduce((count, item) => count + item.quantity, 0),
    }),
    {
      name: "chinexa-cart",
      partialize: (state) => ({
        items: state.items,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
        couponType: state.couponType,
        couponValue: state.couponValue,
        couponMaxDiscount: state.couponMaxDiscount,
      }),
    }
  )
);
