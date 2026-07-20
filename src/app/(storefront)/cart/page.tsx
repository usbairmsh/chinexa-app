"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, X, Loader2, Tag } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { useCartStore } from "@/stores/cart.store";
import { useAuthStore } from "@/stores/auth.store";
import { PriceCalculator } from "@/components/storefront/cart/price-calculator";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getSubtotal, getShipping, getItemCount, couponCode, applyCoupon, removeCoupon, refreshOffers } = useCartStore();
  const storeUser = useAuthStore((s) => s.user);
  const storeAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Persisted auth store differs from server HTML on hard refresh — gate on
  // `mounted` so the first client render matches the server exactly.
  const user = mounted ? storeUser : null;
  const isAuthenticated = mounted && storeAuthenticated;
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

  // Re-evaluate admin offers against the current cart (and customer) on load.
  // Offers are a signed-in perk — skip entirely for guests.
  useEffect(() => {
    if (isAuthenticated) refreshOffers(user?.id || null);
  }, [refreshOffers, isAuthenticated, user?.id, items.length]);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    setCouponSuccess("");
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          order_total: getSubtotal(),
          customer_id: user?.id || null,
          items: items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id || null, price: i.price, quantity: i.quantity })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid && Number.isFinite(Number(data.discount))) {
        applyCoupon(code, Number(data.discount), data.discount_type, Number(data.discount_value) || 0, data.max_discount_amount != null ? Number(data.max_discount_amount) : null);
        setCouponSuccess(`Coupon applied! You save ${Number(data.discount).toLocaleString("en-BD")}৳`);
        setCouponInput("");
      } else {
        setCouponError(data.message || data.error || "Invalid coupon");
      }
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponSuccess("");
    setCouponError("");
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Breadcrumb items={[{ label: "Shopping Bag" }]} className="mb-8" />
        <EmptyState
          icon={ShoppingBag}
          title="Your bag is empty"
          description="Looks like you haven't added anything yet. Explore our collection and find something you love."
          actionLabel="Continue Shopping"
          actionHref="/products"
        />
      </div>
    );
  }

  const shipping = getShipping();

  return (
    <div className="bg-white min-h-screen overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Breadcrumb items={[{ label: "Shopping Bag" }]} className="mb-8" />
        <h1 className="font-heading text-2xl sm:text-3xl font-semibold text-charcoal mb-8">
          Shopping Bag ({getItemCount()})
        </h1>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Items */}
          <div className="lg:col-span-2 min-w-0">
            <AnimatePresence mode="popLayout">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-3 sm:gap-6 py-4 sm:py-6 border-b border-border/30"
                >
                  <Link
                    href={`/products/${item.product_slug}`}
                    prefetch={false}
                    className="group relative h-24 w-[68px] sm:h-40 sm:w-32 flex-shrink-0 rounded-xl overflow-hidden bg-pearl"
                  >
                    <Image
                      src={item.product_image || `https://picsum.photos/seed/${item.product_slug}/300/375`}
                      alt={item.product_name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="128px"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.product_slug}`}
                      prefetch={false}
                      className="text-sm sm:text-base font-medium text-charcoal hover:text-secondary transition-colors line-clamp-2"
                    >
                      {item.product_name}
                    </Link>
                    {item.variant_name && (
                      <p className="text-xs sm:text-sm text-charcoal-lighter mt-1">{item.variant_name}</p>
                    )}
                    <p className="text-base sm:text-lg font-semibold text-charcoal mt-2">
                      {formatCurrency(item.price)}
                    </p>
                    <div className="flex items-center justify-between mt-3 sm:mt-4">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-border hover:border-secondary active:scale-90 transition-[colors,transform] duration-150"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 sm:w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-border hover:border-secondary active:scale-90 transition-[colors,transform] duration-150"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-charcoal-lighter hover:text-destructive active:scale-90 transition-[colors,transform] duration-150 p-2 sm:p-3"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <div>
            <div className="rounded-2xl border border-border/30 bg-pearl/30 shadow-card p-3 sm:p-6">
              <h3 className="font-heading text-base sm:text-lg font-semibold text-charcoal mb-4">Price Details</h3>

              <PriceCalculator
                shippingCost={shipping}
                isFreeShipping={shipping === 0 && getSubtotal() > 0}
              />

              {/* Coupon — signed-in customers only */}
              {isAuthenticated && (
              <div className="mt-5">
                {couponCode ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="p-3 rounded-xl bg-success/5 border border-success/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-success" />
                        <span className="text-sm font-semibold text-success">{couponCode}</span>
                        <span className="text-xs text-success/70">applied</span>
                      </div>
                      <button onClick={handleRemoveCoupon} className="text-charcoal-lighter hover:text-destructive active:scale-90 transition-[colors,transform] duration-150">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {couponSuccess && <p className="text-xs text-success mt-1">{couponSuccess}</p>}
                  </motion.div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Coupon code"
                        className="flex-1 h-10"
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                      />
                      <Button variant="outline" size="sm" onClick={handleApplyCoupon} disabled={couponLoading || !couponInput.trim()}>
                        {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                    {couponError && <p className="text-xs text-destructive mt-1.5">{couponError}</p>}
                  </div>
                )}
              </div>
              )}

              <Link href="/checkout" className="block mt-5">
                <Button variant="secondary" size="lg" className="w-full !text-white">
                  Checkout <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>

              <p className="text-xs text-center text-charcoal-lighter mt-4">
                Free shipping on orders above ৳3,000
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
