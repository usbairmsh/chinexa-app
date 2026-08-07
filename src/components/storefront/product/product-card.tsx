"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag, Clock } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useUIStore } from "@/stores/ui.store";
import { useAuthStore } from "@/stores/auth.store";
import { formatCurrency, cn } from "@/lib/utils";
import { backdropClose } from "@/lib/modal-backdrop";
import { isPreorderable as computeIsPreorderable } from "@/lib/preorder";
import { useStoreSettings } from "@/hooks/use-store-settings";
import type { Product } from "@/types/product";

// Lazy-loaded so framer-motion (its enter/exit + spring animations) is fetched
// only when a shopper opens the add-to-bag modal — not on every homepage card.
const AddToBagModal = dynamic(
  () => import("@/components/storefront/product/add-to-bag-modal").then((m) => m.AddToBagModal),
  { ssr: false }
);

interface ProductCardProps {
  product: Product;
  index?: number;
  /** Set true only for the first (largest/likely-LCP) card in an above-the-fold grid — hints the browser to fetch this image immediately instead of lazily. */
  priority?: boolean;
}

export function ProductCard({ product, index = 0, priority = false }: ProductCardProps) {
  const addToCart = useCartStore((s) => s.addItem);
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  const syncServerWishlist = useWishlistStore((s) => s.syncServer);
  // Selector on the one boolean this card actually needs — a whole-store
  // destructure here would re-render every product card on the page whenever
  // ANY card's wishlist state changes, not just this one.
  const isWishlisted = useWishlistStore((s) => s.items.includes(product.id));
  const setCartDrawerOpen = useUIStore((s) => s.setCartDrawerOpen);
  const showBackInStockToast = useUIStore((s) => s.showBackInStockToast);
  const authUser = useAuthStore((s) => s.user);
  const { preorders_enabled } = useStoreSettings();
  const [mounted, setMounted] = useState(false);
  const wishlisted = mounted && isWishlisted;

  useEffect(() => setMounted(true), []);

  // Out of stock + `preorder` badge + feature on → this card offers a Pre-Order
  // action (linking to the detail page's full reservation flow) instead of a
  // dead "Out of Stock" state. Uses product-level stock; variant-level nuances
  // are handled on the detail page.
  const preorderable = computeIsPreorderable(product, product.stock_quantity, preorders_enabled);

  // Respect the admin's per-tag "hide on card" setting: a hidden badge still
  // lists the product in its section and shows on the detail page, but no chip
  // renders on the card.
  const hiddenOnCard = new Set(product.hidden_card_badges || []);
  const visibleBadges = (product.badges || []).filter((b) => !hiddenOnCard.has(b));

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false); // brief spinner phase before the check

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const wasIn = isWishlisted;
    toggleItem(product.id);
    // Adding an out-of-stock item → record server-side + show the "we'll notify
    // you on restock" popup. In-stock adds / removals stay local.
    if (!wasIn) {
      const productOutOfStock = product.stock_quantity === 0;
      syncServerWishlist(product.id, true, authUser?.id).then(({ outOfStock }) => {
        if (outOfStock || productOutOfStock) showBackInStockToast(product.name);
      });
    } else {
      syncServerWishlist(product.id, false, authUser?.id);
    }
  };

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
    setSelectedVariant(null);
    setQuantity(1);
    setAdded(false);
    setAdding(false);
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
    // Morph: spinner → checkmark → open cart drawer. Item is already added
    // synchronously above; the spinner is tactile feedback only.
    setAdding(true);
    setTimeout(() => { setAdding(false); setAdded(true); }, 350);
    setTimeout(() => {
      setModalOpen(false);
      setAdded(false);
      setCartDrawerOpen(true);
    }, 1050);
  };

  return (
    <>
      <Reveal delay={Math.min(index * 50, 300)}>
        <Link
          href={`/products/${product.slug}`}
          className="group block"
          prefetch={false}
        >
          {/* Image — kept clean on phone/tablet; hover actions only on desktop */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl sm:rounded-2xl bg-image-surface mb-2 sm:mb-3">
            <Image
              src={product.images[0]?.url || `https://picsum.photos/seed/${product.slug}/600/750`}
              // Admin-entered alt text (per-image, from the product form) wins;
              // product name is the fallback — same rule the detail gallery uses.
              alt={product.images[0]?.alt || product.name}
              fill
              priority={priority}
              fetchPriority={priority ? "high" : undefined}
              className="object-cover transition-all duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />

            {product.images[1] && (
              <Image
                src={product.images[1].url}
                alt={product.images[1].alt || `${product.name} alternate`}
                fill
                loading="lazy"
                className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            )}

            {/* Badges — admin-hidden tags are filtered out (they still show on
                the detail page + still drive their section). */}
            {visibleBadges.length > 0 && (
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1 sm:gap-1.5">
                {visibleBadges.map((badge) => (
                  <Badge key={badge} variant={badge} className="text-[10px] px-1.5 sm:px-2.5 uppercase tracking-wider">
                    {badge === "preorder" ? "Pre-order" : badge}
                  </Badge>
                ))}
              </div>
            )}

            {/* Low stock badge — top right */}
            {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-warning !text-white text-[10px] font-semibold shadow-card whitespace-nowrap">Only {product.stock_quantity} left!</span>
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
                        wishlisted ? "bg-secondary !text-white" : "bg-card text-charcoal hover:bg-secondary hover:!text-white"
                      )}
                      aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    >
                      <Heart className={cn("h-[18px] w-[18px]", wishlisted && "fill-current")} />
                    </button>
                  </div>
                ) : preorderable ? (
                  // Pre-order: let the click bubble to the parent Link → detail
                  // page, where quantity/variant selection + expected date live.
                  <div className="w-full h-12 flex items-center justify-center gap-2 rounded-full bg-secondary text-[14px] font-body font-semibold tracking-wide hover:bg-secondary-dark active:scale-[0.96] transition-all duration-300 !text-white">
                    <Clock className="h-[18px] w-[18px]" />
                    Pre-Order
                  </div>
                ) : (
                  <div className="w-full h-12 flex items-center justify-center rounded-full bg-charcoal/80 text-white text-[14px] font-semibold cursor-not-allowed">
                    Out of Stock
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info — fixed min-height so cards (and the loading skeleton) are all
              the same height regardless of optional rows (rating/strike price),
              which keeps the homepage sections from shifting when they load. */}
          <div className="space-y-0.5 sm:space-y-1 px-0.5 min-h-[76px] sm:min-h-[86px]">
            {/* Show the subcategory (more specific); fall back to the category
                when a product has no subcategory. */}
            <p className="text-[10px] sm:text-xs text-charcoal-lighter uppercase tracking-wider truncate">
              {product.subcategory || product.category_name}
            </p>
            <h3 className="text-[13px] sm:text-sm font-medium text-charcoal group-hover:text-secondary transition-colors line-clamp-1">
              {product.name}
            </h3>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-heading text-[13px] sm:text-sm font-semibold text-charcoal">
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
            ) : preorderable ? (
              // Bubbles to the parent Link → detail page's pre-order flow.
              <div className="flex-1 h-9 sm:h-10 flex items-center justify-center gap-1.5 rounded-full bg-secondary !text-white text-[11px] sm:text-xs font-semibold tracking-wide active:scale-[0.96] transition-transform">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Pre-Order
              </div>
            ) : (
              <div className="flex-1 h-9 sm:h-10 flex items-center justify-center rounded-full bg-pearl text-charcoal-lighter text-[11px] sm:text-xs font-semibold">
                Out of Stock
              </div>
            )}
          </div>
        </Link>
      </Reveal>

      {/* ═══════ ADD TO BAG MODAL ═══════ */}
      {/* Lazy-loaded so framer-motion (its enter/exit + spring animations) is
          pulled in only when a shopper actually opens the modal — keeps it out
          of the homepage's initial bundle where dozens of cards render. */}
      {modalOpen && (
        <AddToBagModal
          product={product}
          quantity={quantity}
          setQuantity={setQuantity}
          selectedVariant={selectedVariant}
          setSelectedVariant={setSelectedVariant}
          adding={adding}
          added={added}
          onConfirm={handleConfirmAdd}
          onClose={() => setModalOpen(false)}
          onBackdropClose={backdropClose(() => setModalOpen(false))}
        />
      )}
    </>
  );
}
