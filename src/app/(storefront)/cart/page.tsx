"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, X, Loader2, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { useCartStore } from "@/stores/cart.store";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getSubtotal, getShipping, getDiscount, getTotal, getItemCount, couponCode, applyCoupon, removeCoupon } = useCartStore();
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState("");

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
        body: JSON.stringify({ code, order_total: getSubtotal() }),
      });
      const data = await res.json();
      if (data.valid) {
        applyCoupon(code, data.discount);
        setCouponSuccess(`Coupon applied! You save ${data.discount.toLocaleString("en-BD")}৳`);
        setCouponInput("");
      } else {
        setCouponError(data.message || "Invalid coupon");
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
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3 sm:gap-6 py-4 sm:py-6 border-b border-border/30"
                >
                  <div className="relative h-24 w-[68px] sm:h-40 sm:w-32 flex-shrink-0 rounded-xl overflow-hidden bg-pearl">
                    <Image
                      src={item.product_image}
                      alt={item.product_name}
                      fill
                      className="object-cover"
                      sizes="128px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.product_slug}`}
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
                          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-border hover:border-secondary transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 sm:w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-border hover:border-secondary transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-charcoal-lighter hover:text-destructive transition-colors p-2 sm:p-3"
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
            <div className="rounded-2xl border border-border/30 bg-pearl/30 p-3 sm:p-6 lg:sticky lg:top-24">
              <h3 className="font-heading text-base sm:text-lg font-semibold text-charcoal mb-4">Order Summary</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-charcoal-lighter">Subtotal</span>
                  <span className="font-medium text-charcoal">{formatCurrency(getSubtotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal-lighter">Shipping</span>
                  <span className="font-medium text-charcoal">
                    {getShipping() === 0 ? "Free" : formatCurrency(getShipping())}
                  </span>
                </div>
                {getDiscount() > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount</span>
                    <span>-{formatCurrency(getDiscount())}</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="flex justify-between text-lg font-semibold text-charcoal mb-6">
                <span>Total</span>
                <span>{formatCurrency(getTotal())}</span>
              </div>

              {/* Coupon */}
              {couponCode ? (
                <div className="mb-6 p-3 rounded-xl bg-success/5 border border-success/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-success" />
                      <span className="text-sm font-semibold text-success">{couponCode}</span>
                      <span className="text-xs text-success/70">applied</span>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-charcoal-lighter hover:text-destructive transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {couponSuccess && <p className="text-xs text-success mt-1">{couponSuccess}</p>}
                </div>
              ) : (
                <div className="mb-6">
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

              <Link href="/checkout">
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
