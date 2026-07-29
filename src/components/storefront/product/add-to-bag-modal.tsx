"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Minus, Plus, Check, X, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product } from "@/types/product";

/**
 * Add-to-bag modal, extracted from ProductCard and lazy-loaded (next/dynamic)
 * so framer-motion only ships when a shopper opens it — keeping it out of the
 * homepage's initial bundle where dozens of cards render. All state lives in
 * the parent card; this component is purely presentational + animated.
 */
interface AddToBagModalProps {
  product: Product;
  quantity: number;
  setQuantity: (n: number) => void;
  selectedVariant: string | null;
  setSelectedVariant: (id: string | null) => void;
  adding: boolean;
  added: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onBackdropClose: (e: React.MouseEvent) => void;
}

export function AddToBagModal({
  product,
  quantity,
  setQuantity,
  selectedVariant,
  setSelectedVariant,
  adding,
  added,
  onConfirm,
  onClose,
  onBackdropClose,
}: AddToBagModalProps) {
  const variantAdjust = product.variants.find((v) => v.id === selectedVariant)?.price_adjustment || 0;

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-sm"
          onClick={onBackdropClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md bg-card rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors active:scale-[0.96]"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Product Preview */}
          <div className="flex gap-4 p-5 pb-0">
            <div className="relative h-28 w-[88px] sm:h-32 sm:w-24 rounded-xl overflow-hidden bg-image-surface shrink-0">
              <Image
                src={product.images[0]?.url || `https://picsum.photos/seed/${product.slug}/200/250`}
                alt={product.name}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-[10px] text-charcoal-lighter uppercase tracking-widest">{product.category_name}</p>
              <h3 className="text-sm font-semibold text-charcoal mt-0.5 line-clamp-2">{product.name}</h3>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-lg font-bold text-charcoal">{formatCurrency(product.price + variantAdjust)}</span>
                {product.compare_at_price && (
                  <span className="text-xs text-charcoal-lighter line-through">{formatCurrency(product.compare_at_price)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Variants */}
            {product.variants.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2.5">
                  {product.variants[0]?.type === "color" ? "Select Color" : product.variants[0]?.type === "size" ? "Select Size" : "Select Option"}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant.id === selectedVariant ? null : variant.id)}
                      disabled={variant.stock === 0}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 active:scale-[0.96]",
                        selectedVariant === variant.id
                          ? "border-secondary bg-secondary !text-white"
                          : "border-border text-charcoal hover:border-charcoal",
                        variant.stock === 0 && "opacity-30 cursor-not-allowed line-through"
                      )}
                    >
                      {variant.hex && (
                        <span
                          className={cn("h-3.5 w-3.5 rounded-full border", selectedVariant === variant.id ? "border-white" : "border-border/50")}
                          style={{ backgroundColor: variant.hex }}
                        />
                      )}
                      {variant.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <h4 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2.5">Quantity</h4>
              <div className="flex items-center h-10 border border-border rounded-full overflow-hidden w-fit">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex items-center justify-center w-10 h-full text-charcoal-lighter hover:text-charcoal hover:bg-pearl transition-colors active:scale-[0.9]"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-10 text-center text-sm font-semibold text-charcoal select-none">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="flex items-center justify-center w-10 h-full text-charcoal-lighter hover:text-charcoal hover:bg-pearl transition-colors active:scale-[0.9]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <Separator />

            {/* Confirm Button */}
            <motion.button
              onClick={onConfirm}
              disabled={added || adding || (product.variants.length > 0 && !selectedVariant)}
              className={cn(
                "h-12 rounded-full font-body font-semibold text-[14px] tracking-wide transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:enabled:scale-[0.97] overflow-hidden mx-auto",
                adding ? "w-12 px-0 bg-secondary !text-white" : "w-full",
                added
                  ? "bg-success !text-white"
                  : !adding && "bg-secondary !text-white hover:bg-secondary-dark hover:shadow-[0_6px_30px_rgba(122,79,160,0.4)] hover:-translate-y-[1px]"
              )}
            >
              <AnimatePresence mode="wait">
                {adding ? (
                  <motion.span key="adding" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </motion.span>
                ) : added ? (
                  <motion.span key="done" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
                    <Check className="h-5 w-5" /> Added!
                  </motion.span>
                ) : (
                  <motion.span key="add" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    {product.variants.length > 0 && !selectedVariant ? "Select an option" : `Add to Bag — ${formatCurrency((product.price + variantAdjust) * quantity)}`}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
