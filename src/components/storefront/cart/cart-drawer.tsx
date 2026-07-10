"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingBag, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart.store";
import { useUIStore } from "@/stores/ui.store";
import { formatCurrency } from "@/lib/utils";
import { useEffect } from "react";

export function CartDrawer() {
  const { cartDrawerOpen, setCartDrawerOpen } = useUIStore();
  const { items, removeItem, updateQuantity, getSubtotal, getItemCount } = useCartStore();

  // Lock body scroll when open
  useEffect(() => {
    if (cartDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [cartDrawerOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && cartDrawerOpen) setCartDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cartDrawerOpen, setCartDrawerOpen]);

  return (
    <AnimatePresence>
      {cartDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-charcoal/40 backdrop-blur-sm"
            onClick={() => setCartDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel — slides in from right, slides out to right */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-background shadow-luxury-hover border-l border-border/30 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="flex items-center gap-2 text-lg font-heading font-semibold text-charcoal">
                <ShoppingBag className="h-5 w-5 text-secondary" />
                Shopping Bag ({getItemCount()})
              </h2>
              <button
                onClick={() => setCartDrawerOpen(false)}
                className="rounded-full p-2.5 text-charcoal-lighter hover:text-charcoal hover:bg-primary-light transition-colors"
                aria-label="Close cart"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {items.length === 0 ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-light mb-4 mx-auto">
                    <ShoppingBag className="h-10 w-10 text-secondary" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-charcoal mb-1">
                    Your bag is empty
                  </h3>
                  <p className="text-sm text-charcoal-lighter mb-6">
                    Discover beautiful products waiting for you
                  </p>
                  <Link href="/products" onClick={() => setCartDrawerOpen(false)}>
                    <Button variant="primary">Continue Shopping</Button>
                  </Link>
                </motion.div>
              </div>
            ) : (
              <>
                {/* Items */}
                <div className="flex-1 overflow-y-auto px-6 py-2">
                  <AnimatePresence mode="popLayout">
                    {items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex gap-4 py-4 border-b border-border/30 last:border-0"
                      >
                        <div className="relative h-24 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-pearl">
                          <Image
                            src={item.product_image || `https://picsum.photos/seed/${item.product_slug}/160/192`}
                            alt={item.product_name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/products/${item.product_slug}`}
                            prefetch={false}
                            className="text-sm font-medium text-charcoal hover:text-secondary transition-colors line-clamp-1"
                            onClick={() => setCartDrawerOpen(false)}
                          >
                            {item.product_name}
                          </Link>
                          {item.variant_name && (
                            <p className="text-xs text-charcoal-lighter mt-0.5">{item.variant_name}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-secondary transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:border-secondary transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-charcoal">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-2 text-charcoal-lighter hover:text-destructive transition-colors"
                                aria-label="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="mt-auto border-t border-border/50 p-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-lighter">Subtotal</span>
                    <span className="font-semibold text-charcoal">{formatCurrency(getSubtotal())}</span>
                  </div>
                  <p className="text-xs text-charcoal-lighter">
                    Shipping calculated at checkout
                  </p>
                  <Separator />
                  <div className="grid gap-2">
                    <Link href="/checkout" onClick={() => setCartDrawerOpen(false)}>
                      <Button variant="secondary" className="w-full !text-white">Checkout</Button>
                    </Link>
                    <Link href="/cart" onClick={() => setCartDrawerOpen(false)}>
                      <Button variant="outline" className="w-full">View Cart</Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
