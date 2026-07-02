"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types/cart";

interface CartState {
  items: CartItem[];
  couponCode: string | null;
  couponDiscount: number;
  couponType: "percentage" | "fixed" | null;
  couponValue: number;
  couponMaxDiscount: number | null;

  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number, type?: "percentage" | "fixed", value?: number, maxDiscount?: number | null) => void;
  removeCoupon: () => void;

  getSubtotal: () => number;
  getShipping: () => number;
  getDiscount: () => number;
  getSavings: () => number;
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

      addItem: (item) =>
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
        }),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.id !== id)
            : state.items.map((i) =>
                i.id === id ? { ...i, quantity: Math.min(quantity, i.stock) } : i
              ),
        })),

      clearCart: () => set({ items: [], couponCode: null, couponDiscount: 0, couponType: null, couponValue: 0, couponMaxDiscount: null }),

      applyCoupon: (code, discount, type, value, maxDiscount) =>
        set({
          couponCode: code,
          couponDiscount: discount,
          couponType: type || "fixed",
          couponValue: value || discount,
          couponMaxDiscount: maxDiscount ?? null,
        }),

      removeCoupon: () => set({ couponCode: null, couponDiscount: 0, couponType: null, couponValue: 0, couponMaxDiscount: null }),

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

      getDiscount: () => {
        const state = get();
        if (!state.couponCode) return 0;
        if (state.couponType === "percentage") {
          const subtotal = state.getSubtotal();
          let discount = (subtotal * state.couponValue) / 100;
          if (state.couponMaxDiscount) discount = Math.min(discount, state.couponMaxDiscount);
          return Math.round(discount);
        }
        return state.couponDiscount;
      },

      getSavings: () =>
        get().items.reduce((sum, item) => {
          if (item.compare_at_price && item.compare_at_price > item.price) {
            return sum + (item.compare_at_price - item.price) * item.quantity;
          }
          return sum;
        }, 0),

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const shipping = get().getShipping();
        const discount = get().getDiscount();
        return Math.max(0, subtotal + shipping - discount);
      },

      getItemCount: () =>
        get().items.reduce((count, item) => count + item.quantity, 0),
    }),
    {
      name: "chinexa-cart",
    }
  )
);
