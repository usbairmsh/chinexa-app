"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag, Minus, Plus, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useUIStore } from "@/stores/ui.store";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product } from "@/types/product";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const addToCart = useCartStore((s) => s.addItem);
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  // Selector on the one boolean this card actually needs — a whole-store
  // destructure here would re-render every product card on the page whenever
  // ANY card's wishlist state changes, not just this one.
  const isWishlisted = useWishlistStore((s) => s.items.includes(product.id));
  const setCartDrawerOpen = useUIStore((s) => s.setCartDrawerOpen);
  const [mounted, setMounted] = useState(false);
  const wishlisted = mounted && isWishlisted;

  useEffect(() => setMounted(true), []);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product.id);
  };

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
    setSelectedVariant(null);
    setQuantity(1);
    setAdded(false);
  };

  const handleConfirmAdd = () => {
    const activeVariant = product.variants.find((v) => v.id === selectedVariant);
    addToCart({
      id: "",
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image: product.images[0]?.url || "",
      variant_id: activeVariant?.id,
      variant_name: activeVariant?.name,
      price: product.price + (activeVariant?.price_adjustment || 0),
      // Keep compare price consistent with the product detail page (variant-adjusted)
      compare_at_price: product.compare_at_price ? product.compare_at_price + (activeVariant?.price_adjustment || 0) : undefined,
      quantity,
      // Ternary, not "||": a variant with 0 stock must NOT fall back to product-level stock
      stock: activeVariant ? activeVariant.stock : product.stock_quantity,
    });
    setAdded(true);
    setTimeout(() => {
      setModalOpen(false);
      setAdded(false);
      setCartDrawerOpen(true);
    }, 800);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.05 }}
      >
        <Link
          href={`/products/${product.slug}`}
          className="group block"
          prefetch={false}
        >
          {/* Image — kept clean on phone/tablet; hover actions only on desktop */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl sm:rounded-2xl bg-pearl mb-2 sm:mb-3">
            <Image
              src={product.images[0]?.url || `https://picsum.photos/seed/${product.slug}/600/750`}
              alt={product.name}
              fill
              className="object-cover transition-all duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />

            {product.images[1] && (
              <Image
                src={product.images[1].url}
                alt={`${product.name} alternate`}
                fill
                loading="lazy"
                className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            )}

            {/* Badges */}
            {product.badges.length > 0 && (
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1 sm:gap-1.5">
                {product.badges.map((badge) => (
                  <Badge key={badge} variant={badge} className="text-[8px] sm:text-[10px] px-1.5 sm:px-2.5 uppercase tracking-wider">
                    {badge === "preorder" ? "Pre-order" : badge}
                  </Badge>
                ))}
              </div>
            )}

            {/* Low stock badge — top right */}
            {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8px] sm:text-[9px] font-semibold shadow-card whitespace-nowrap">Only {product.stock_quantity} left!</span>
              </div>
            )}

            {/* Desktop only: Add to Bag + Wishlist slide up on hover.
                Hidden below lg — touch devices have no hover, so they get the
                static action row under the card instead. */}
            <div className="hidden lg:block absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <div className="bg-gradient-to-t from-black/50 to-transparent pt-8 pb-3 px-3">
                {product.stock_quantity > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openModal}
                      className="flex-1 h-12 flex items-center justify-center gap-2 rounded-full bg-secondary text-[14px] font-body font-semibold tracking-wide hover:bg-secondary-dark hover:shadow-[0_6px_30px_rgba(122,79,160,0.4)] hover:-translate-y-[1px] active:scale-[0.96] transition-all duration-300 !text-white"
                    >
                      <ShoppingBag className="h-[18px] w-[18px]" />
                      Add to Bag
                    </button>
                    <button
                      onClick={handleWishlist}
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold hover:shadow-[0_6px_30px_rgba(122,79,160,0.4)] hover:-translate-y-[1px] active:scale-[0.96] transition-all duration-300",
                        wishlisted ? "bg-secondary !text-white" : "bg-white text-charcoal hover:bg-secondary hover:!text-white"
                      )}
                      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    >
                      <Heart className={cn("h-[18px] w-[18px]", wishlisted && "fill-current")} />
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-12 flex items-center justify-center rounded-full bg-charcoal/80 text-white text-[14px] font-semibold cursor-not-allowed">
                    Out of Stock
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-0.5 sm:space-y-1 px-0.5">
            <p className="text-[10px] sm:text-xs text-charcoal-lighter uppercase tracking-wider truncate">
              {product.category_name}
            </p>
            <h3 className="text-[13px] sm:text-sm font-medium text-charcoal group-hover:text-secondary transition-colors line-clamp-1">
              {product.name}
            </h3>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[13px] sm:text-sm font-semibold text-charcoal">
                {formatCurrency(product.price)}
              </span>
              {product.compare_at_price && (
                <span className="text-[10px] sm:text-xs text-charcoal-lighter line-through">
                  {formatCurrency(product.compare_at_price)}
                </span>
              )}
            </div>
            {product.average_rating > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3", i < Math.round(product.average_rating) ? "text-gold fill-gold" : "text-border")}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-[9px] sm:text-[10px] text-charcoal-lighter">({product.review_count})</span>
              </div>
            )}
          </div>

          {/* Phone & tablet actions — always visible, below the card so the
              photo stays clean. Desktop uses the hover overlay instead. */}
          <div className="mt-2 flex items-center gap-1.5 lg:hidden">
            {product.stock_quantity > 0 ? (
              <>
                <button
                  onClick={openModal}
                  className="flex-1 h-9 sm:h-10 flex items-center justify-center gap-1.5 rounded-full bg-secondary !text-white text-[11px] sm:text-xs font-semibold tracking-wide active:scale-[0.96] transition-transform"
                >
                  <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Add to Bag
                </button>
                <button
                  onClick={handleWishlist}
                  className={cn(
                    "flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-[0.96]",
                    wishlisted
                      ? "border-secondary bg-secondary !text-white"
                      : "border-border text-charcoal-lighter"
                  )}
                  aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", wishlisted && "fill-current")} />
                </button>
              </>
            ) : (
              <div className="flex-1 h-9 sm:h-10 flex items-center justify-center rounded-full bg-pearl text-charcoal-lighter text-[11px] sm:text-xs font-semibold">
                Out of Stock
              </div>
            )}
          </div>
        </Link>
      </motion.div>

      {/* ═══════ ADD TO BAG MODAL ═══════ */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden"
            >
              {/* Close */}
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors active:scale-[0.96]"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Product Preview */}
              <div className="flex gap-4 p-5 pb-0">
                <div className="relative h-28 w-[88px] sm:h-32 sm:w-24 rounded-xl overflow-hidden bg-pearl shrink-0">
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
                    <span className="text-lg font-bold text-charcoal">{formatCurrency(product.price + (product.variants.find(v => v.id === selectedVariant)?.price_adjustment || 0))}</span>
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
                <button
                  onClick={handleConfirmAdd}
                  disabled={added || (product.variants.length > 0 && !selectedVariant)}
                  className={cn(
                    "w-full h-12 rounded-full font-body font-semibold text-[14px] tracking-wide transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:enabled:scale-[0.97]",
                    added
                      ? "bg-success !text-white"
                      : "bg-secondary !text-white hover:bg-secondary-dark hover:shadow-[0_6px_30px_rgba(122,79,160,0.4)] hover:-translate-y-[1px]"
                  )}
                >
                  <AnimatePresence mode="wait">
                    {added ? (
                      <motion.span key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                        <Check className="h-5 w-5" /> Added!
                      </motion.span>
                    ) : (
                      <motion.span key="add" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        {product.variants.length > 0 && !selectedVariant ? "Select an option" : `Add to Bag — ${formatCurrency((product.price + (product.variants.find(v => v.id === selectedVariant)?.price_adjustment || 0)) * quantity)}`}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
