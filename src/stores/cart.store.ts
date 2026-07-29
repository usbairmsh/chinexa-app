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
  /** The customer this store is currently synced to (null = guest/logged out).
   *  Late/async server responses and debounced saves check this so a stale
   *  reply or save for a signed-out/switched account is never applied. Not
   *  persisted — re-established from auth on each session. */
  activeCustomerId: string | null;
  couponCode: string | null;
  couponDiscount: number;
  couponType: "percentage" | "fixed" | null;
  couponValue: number;
  couponMaxDiscount: number | null;

  // Offer state — populated from /api/offers/apply (admin offers section only)
  offerDiscount: number;
  appliedOffers: AppliedOffer[];
  offerLines: OfferLine[];

  /** Adds an item. Returns "mixed" (and adds nothing) when the item's
   *  pre-order mode conflicts with what's already in the cart — pre-order and
   *  in-stock items must be checked out separately. Returns "ok" otherwise. */
  addItem: (item: CartItem) => "ok" | "mixed";
  removeItem: (id: string) => void;
  /** True when the cart currently holds at least one pre-order line. */
  isPreorderCart: () => boolean;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number, type?: "percentage" | "fixed", value?: number, maxDiscount?: number | null) => void;
  removeCoupon: () => void;
  /** Re-evaluate active admin offers against the current cart (server-authoritative). */
  refreshOffers: (customerId?: string | null) => Promise<void>;

  /**
   * Load the customer's server-saved cart.
   *
   * - merge = true (fresh LOGIN only): union the local guest cart into the
   *   server cart, summing shared lines, so a cart built while signed out isn't
   *   lost. Runs exactly once per sign-in.
   * - merge = false (page RELOAD, already authenticated): ADOPT the server cart
   *   as-is. The local persisted copy is just a stale mirror of the same cart,
   *   so replacing (not merging) is correct — merging on every reload would
   *   double the quantities each time.
   *
   * No-op without a customerId. Respects the pre-order/in-stock separation rule.
   */
  loadServer: (customerId: string, merge?: boolean) => Promise<void>;
  /** Persist the current cart to the server for a logged-in customer (whole-cart
   *  upsert). Called debounced on cart changes and no-ops without a customerId. */
  saveServer: (customerId?: string | null) => Promise<void>;
  /** Set/clear the customer this store syncs for (called on login/logout). */
  setActiveCustomer: (customerId: string | null) => void;

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
      activeCustomerId: null,
      couponCode: null,
      couponDiscount: 0,
      couponType: null,
      couponValue: 0,
      couponMaxDiscount: null,
      offerDiscount: 0,
      appliedOffers: [],
      offerLines: [],

      setActiveCustomer: (customerId) => set({ activeCustomerId: customerId }),

      addItem: (item) => {
        const state = get();
        // Separate-checkout rule: a cart is either all pre-order or all in-stock.
        // If the incoming item's mode differs from the existing cart, reject it
        // (the caller surfaces a "check out separately" message) rather than
        // silently mixing timelines.
        const incomingPreorder = !!item.isPreorder;
        const cartHasPreorder = state.items.some((i) => i.isPreorder);
        const cartHasInStock = state.items.some((i) => !i.isPreorder);
        if (state.items.length > 0 && ((incomingPreorder && cartHasInStock) || (!incomingPreorder && cartHasPreorder))) {
          return "mixed";
        }
        set((s) => {
          const existing = s.items.find(
            (i) => i.product_id === item.product_id && i.variant_id === item.variant_id
          );
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.product_id === item.product_id && i.variant_id === item.variant_id
                  // Pre-order lines have no real stock to clamp against, so only
                  // clamp in-stock lines to their available stock.
                  ? { ...i, quantity: item.isPreorder ? i.quantity + item.quantity : Math.min(i.quantity + item.quantity, i.stock) }
                  : i
              ),
            };
          }
          return { items: [...s.items, { ...item, id: `cart-${Date.now()}` }] };
        });
        return "ok";
      },

      isPreorderCart: () => get().items.some((i) => i.isPreorder),

      removeItem: (id) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
      },

      updateQuantity: (id, quantity) => {
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.id !== id)
            : state.items.map((i) =>
                // Pre-order lines aren't bounded by stock (there is none yet).
                i.id === id ? { ...i, quantity: i.isPreorder ? quantity : Math.min(quantity, i.stock) } : i
              ),
        }));
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

      loadServer: async (customerId, merge = false) => {
        if (!customerId) return;
        try {
          const localItems = get().items;
          const res = await fetch(`/api/cart?customer_id=${encodeURIComponent(customerId)}`, { cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json();
          // Guard: if the active customer changed while this fetch was in flight
          // (logout, or switched account), discard the response — never write a
          // stale/other account's cart into state.
          if (get().activeCustomerId !== customerId) return;

          // Sanitize server lines: coerce quantity/stock to safe numbers so a
          // malformed persisted line can never poison totals with NaN.
          const sanitize = (i: CartItem): CartItem => {
            const q = Number(i.quantity);
            const s = Number(i.stock);
            return {
              ...i,
              quantity: Number.isFinite(q) && q > 0 ? Math.floor(q) : 1,
              stock: Number.isFinite(s) && s > 0 ? Math.floor(s) : 9999,
            };
          };
          const serverItems: CartItem[] = (Array.isArray(data?.items) ? data.items : []).map(sanitize);
          const hasSaved = !!data?.has_saved;
          const keyOf = (i: CartItem) => `${i.product_id}::${i.variant_id || ""}`;

          let result: CartItem[];
          let changed = merge; // whether the server needs a follow-up save

          if (!merge) {
            // RELOAD path: the server cart is authoritative. Adopt it as-is — do
            // NOT combine with the local mirror (that would double quantities
            // every refresh). Only fall back to local when the customer has NEVER
            // saved a cart (has_saved=false): an intentionally EMPTIED cart
            // (has_saved=true, []) must stick, not resurrect from stale local.
            if (!hasSaved && localItems.length > 0) {
              result = localItems.map(sanitize);
              changed = true;
            } else {
              result = serverItems;
            }
          } else {
            // LOGIN path: union server + local guest cart by (product, variant),
            // summing shared lines so a guest cart isn't lost on sign-in.
            const byKey = new Map<string, CartItem>();
            for (const it of serverItems) byKey.set(keyOf(it), { ...it });
            for (const it of localItems.map(sanitize)) {
              const k = keyOf(it);
              const existing = byKey.get(k);
              if (existing) {
                existing.quantity = it.isPreorder
                  ? existing.quantity + it.quantity
                  : Math.min(existing.quantity + it.quantity, it.stock || existing.stock || existing.quantity + it.quantity);
              } else {
                byKey.set(k, { ...it });
              }
            }
            result = Array.from(byKey.values());
          }

          // Enforce the pre-order / in-stock separation: a cart can't mix both.
          // If the result is mixed, prefer in-stock lines (the common case).
          const hasPre = result.some((i) => i.isPreorder);
          const hasStock = result.some((i) => !i.isPreorder);
          if (hasPre && hasStock) {
            result = result.filter((i) => !i.isPreorder);
            changed = true;
          }

          // Re-id every line so ids stay unique/local.
          result = result.map((i, idx) => ({ ...i, id: `cart-${idx}-${i.product_id}` }));
          const couponCode = typeof data?.coupon_code === "string" ? data.coupon_code : get().couponCode;
          set({ items: result, couponCode: couponCode ?? get().couponCode });

          // Only write back when we actually changed the server's copy (a login
          // merge, or a local-only cart we just uploaded). A plain reload that
          // simply adopted the server cart writes nothing.
          if (changed) await get().saveServer(customerId);
        } catch {
          // Network error — keep the local cart; retry next time.
        }
      },

      saveServer: async (customerId) => {
        if (!customerId) return;
        // Guard (Critical): only ever persist for the CURRENTLY active customer.
        // A debounced save can fire after logout/switch with a stale captured id;
        // without this it could PUT an empty/old cart and wipe the real one.
        if (get().activeCustomerId !== customerId) return;
        try {
          await fetch("/api/cart", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: customerId,
              items: get().items,
              coupon_code: get().couponCode,
            }),
          });
        } catch {
          // Best-effort; the local persist still holds the cart meanwhile.
        }
      },

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
