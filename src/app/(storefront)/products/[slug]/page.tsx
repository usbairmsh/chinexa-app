"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, ShoppingBag, Minus, Plus, Share2, Shield, Truck, RotateCcw,
  ChevronLeft, ChevronRight, Star, Check, Clock, Package, Globe, Sparkles, Copy, Loader2, X, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useProduct, useRelatedProducts } from "@/hooks/queries/use-products";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useUIStore } from "@/stores/ui.store";
import { useAuthStore } from "@/stores/auth.store";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { getIconById, type TrustBadge } from "@/lib/trust-badges";

function StorefrontTrustBadges({ badgeIds }: { badgeIds: string[] }) {
  const [badges, setBadges] = useState<TrustBadge[]>([]);
  useEffect(() => {
    fetch("/api/settings?key=trust_badges_config")
      .then((r) => r.json())
      .then((data) => {
        if (data?.value && Array.isArray(data.value)) {
          const all: TrustBadge[] = data.value;
          const selected = badgeIds.length > 0 ? all.filter((b) => badgeIds.includes(b.id)) : all.slice(0, 3);
          setBadges(selected);
        }
      })
      .catch(() => {});
  }, [badgeIds]);

  if (badges.length === 0) return null;

  return (
    <div className={cn("grid gap-3", badges.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : badges.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {badges.map((badge) => {
        const Icon = getIconById(badge.icon);
        return (
          <div key={badge.id} className="flex flex-col items-center text-center p-3 rounded-xl bg-pearl/60">
            <Icon className="h-5 w-5 text-secondary mb-1.5" />
            <span className="text-[11px] font-semibold text-charcoal leading-tight">{badge.title}</span>
            <span className="text-[9px] text-charcoal-lighter">{badge.description}</span>
          </div>
        );
      })}
    </div>
  );
}

interface ReviewData {
  id: string; customer_name: string; rating: number; title: string | null;
  comment: string; is_verified_purchase: boolean; admin_reply: string | null; created_at: string;
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = useProduct(slug);
  const { data: relatedProducts } = useRelatedProducts(product?.id || "");
  const addToCart = useCartStore((s) => s.addItem);
  const { toggleItem, isInWishlist } = useWishlistStore();
  const setCartDrawerOpen = useUIStore((s) => s.setCartDrawerOpen);
  const authUser = useAuthStore((s) => s.user);

  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { free_delivery_threshold } = useStoreSettings();
  const [shared, setShared] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}/products/${product?.slug || ""}`;
    navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 5000);
  };

  // Reviews
  const [productReviews, setProductReviews] = useState<ReviewData[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Fetch approved reviews for this product
  useEffect(() => {
    if (!product?.id) return;
    fetch(`/api/reviews?product_id=${product.id}&is_approved=true&limit=20`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProductReviews(data); })
      .catch(() => {});
  }, [product?.id]);

  const handleSubmitReview = async () => {
    if (!product || !reviewComment.trim()) return;
    setReviewSubmitting(true);
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          product_name: product.name,
          customer_id: authUser?.id || null,
          customer_name: authUser?.name || "Anonymous",
          rating: reviewRating,
          title: reviewTitle.trim() || null,
          comment: reviewComment.trim(),
          is_verified_purchase: !!authUser,
          is_approved: false,
        }),
      });
      setReviewSuccess(true);
      setShowReviewForm(false);
      setReviewTitle(""); setReviewComment(""); setReviewRating(5);
      setTimeout(() => setReviewSuccess(false), 4000);
    } catch {} finally { setReviewSubmitting(false); }
  };

  // Compute rating distribution from real reviews
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = productReviews.filter((r) => Number(r.rating) === stars).length;
    const pct = productReviews.length > 0 ? Math.round((count / productReviews.length) * 100) : 0;
    return { stars, count, pct };
  });

  const realAvgRating = productReviews.length > 0
    ? (productReviews.reduce((s, r) => s + Number(r.rating), 0) / productReviews.length).toFixed(1)
    : product?.average_rating?.toFixed(1) || "0";
  const realReviewCount = productReviews.length || product?.review_count || 0;
  const [addedToCart, setAddedToCart] = useState(false);

  // ─── Loading Skeleton ───
  if (isLoading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-6">
          <Skeleton className="h-4 w-48 mb-8" />
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-14">
            <div className="lg:col-span-7 flex gap-4">
              <div className="hidden sm:flex flex-col gap-3 w-20">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}</div>
              <Skeleton className="flex-1 aspect-[3/4] rounded-2xl" />
            </div>
            <div className="lg:col-span-5 space-y-5">
              <Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-48" />
              <Skeleton className="h-20 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-14 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Not Found ───
  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center">
        <Package className="h-16 w-16 text-charcoal-lighter/30 mx-auto mb-4" />
        <h1 className="font-heading text-2xl font-semibold text-charcoal mb-2">Product Not Found</h1>
        <p className="text-charcoal-lighter mb-8">The product you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Link href="/products"><Button variant="primary">Browse Products</Button></Link>
      </div>
    );
  }

  const wishlisted = isInWishlist(product.id);
  const activeVariant = product.variants.find((v) => v.id === selectedVariant);
  const finalPrice = product.price + (activeVariant?.price_adjustment || 0);
  const finalComparePrice = product.compare_at_price ? product.compare_at_price + (activeVariant?.price_adjustment || 0) : undefined;
  const discountPercent = finalComparePrice ? Math.round((1 - finalPrice / finalComparePrice) * 100) : 0;

  // A variant must be chosen before adding to cart when the product has variants.
  const variantRequired = product.variants.length > 0 && !selectedVariant;

  const handleAddToCart = () => {
    if (variantRequired) return;
    addToCart({
      id: "",
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image: product.images[0]?.url || "",
      variant_id: activeVariant?.id,
      variant_name: activeVariant?.name,
      price: finalPrice,
      compare_at_price: finalComparePrice,
      quantity,
      stock: activeVariant?.stock || product.stock_quantity,
    });
    setAddedToCart(true);
    setTimeout(() => {
      setAddedToCart(false);
      setCartDrawerOpen(true);
    }, 800);
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 pt-5 pb-2">
        <Breadcrumb items={[
          { label: product.category_name, href: `/categories/${product.category_id}` },
          { label: product.name },
        ]} />
      </div>

      {/* ═══════ MAIN PRODUCT SECTION ═══════ */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 pb-16">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-14">

          {/* ── LEFT: Gallery ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="lg:col-span-7 flex flex-col-reverse sm:flex-row gap-4"
          >
            {/* Thumbnails — vertical on desktop */}
            {product.images.length > 1 && (
              <div className="flex sm:flex-col gap-2.5 overflow-x-auto sm:overflow-y-auto sm:w-[72px] shrink-0 pb-1 sm:pb-0 sm:max-h-[600px]">
                {product.images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "relative h-16 w-16 sm:h-[72px] sm:w-[72px] shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200",
                      selectedImage === i
                        ? "border-secondary ring-1 ring-secondary/30 opacity-100"
                        : "border-transparent opacity-50 hover:opacity-100"
                    )}
                  >
                    <Image src={img.url} alt={img.alt} fill className="object-cover" sizes="72px" />
                  </button>
                ))}
              </div>
            )}

            {/* Main Image */}
            <div
              className="relative flex-1 aspect-[3/4] sm:aspect-auto sm:min-h-[500px] lg:min-h-[600px] rounded-2xl overflow-hidden bg-pearl group cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0"
                >
                  <Image
                    src={product.images[selectedImage]?.url || `https://picsum.photos/seed/${product.slug}/600/750`}
                    alt={product.images[selectedImage]?.alt || product.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    priority
                    sizes="(max-width: 1024px) 100vw, 58vw"
                  />
                </motion.div>
              </AnimatePresence>

              {/* Badges */}
              {product.badges.length > 0 && (
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                  {product.badges.map((badge) => (
                    <Badge key={badge} variant={badge} className="uppercase tracking-wider text-[10px] font-bold px-2.5 py-1">
                      {badge === "preorder" ? "Pre-order" : badge}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Discount badge */}
              {discountPercent > 0 && (
                <div className="absolute top-4 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-white text-xs font-bold shadow-lg">
                  -{discountPercent}%
                </div>
              )}

              {/* Nav Arrows */}
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedImage((p) => (p - 1 + product.images.length) % product.images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-white z-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5 text-charcoal" />
                  </button>
                  <button
                    onClick={() => setSelectedImage((p) => (p + 1) % product.images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-white z-10"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5 text-charcoal" />
                  </button>
                </>
              )}

              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center bg-black/30 backdrop-blur-md rounded-full px-1 py-0.5">
                {product.images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className="flex items-center justify-center h-7 w-7"
                    aria-label={`View image ${i + 1}`}
                  >
                    <span className={cn("rounded-full transition-all", i === selectedImage ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50")} />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT: Product Info (sticky) ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-5"
          >
            <div className="lg:sticky lg:top-24 space-y-5">
              {/* Category + Title + Price */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-charcoal-lighter uppercase tracking-[0.15em] font-medium">
                    {product.category_name}
                  </span>
                  {product.country_of_origin && (
                    <>
                      <span className="text-charcoal-lighter/30">|</span>
                      <span className="text-[11px] text-charcoal-lighter flex items-center gap-1">
                        {getCountryFlag(product.country_of_origin)} {product.country_of_origin}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="font-heading text-2xl sm:text-3xl lg:text-[2rem] font-semibold text-charcoal leading-tight mb-4">
                  {product.name}
                </h1>

                {/* Rating */}
                {product.average_rating > 0 && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={cn("h-4 w-4", i < Math.round(product.average_rating) ? "text-gold fill-gold" : "text-border")} />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-charcoal">{product.average_rating}</span>
                    <Link href="#reviews" className="text-sm text-charcoal-lighter hover:text-secondary transition-colors underline-offset-2 hover:underline">
                      {product.review_count} reviews
                    </Link>
                  </div>
                )}

                {/* Price */}
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-charcoal">
                    {formatCurrency(finalPrice)}
                  </span>
                  {finalComparePrice && (
                    <span className="text-lg text-charcoal-lighter line-through">
                      {formatCurrency(finalComparePrice)}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-sm font-semibold text-secondary">Save {discountPercent}%</span>
                  )}
                </div>
              </div>

              {/* Short Description */}
              <p className="text-[15px] text-charcoal-light leading-relaxed">
                {product.short_description}
              </p>

              <Separator className="!my-5" />

              {/* Variants */}
              {product.variants.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-charcoal">
                      {product.variants[0]?.type === "color" ? "Color" : product.variants[0]?.type === "size" ? "Size" : "Option"}
                    </h3>
                    {activeVariant && (
                      <span className="text-xs text-charcoal-lighter">Selected: <span className="text-charcoal font-medium">{activeVariant.name}</span></span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => {
                          const newId = variant.id === selectedVariant ? null : variant.id;
                          setSelectedVariant(newId);
                          // If variant has its own image, find its index in images and switch to it
                          if (newId && variant.image) {
                            const imgIdx = product.images.findIndex((img) => img.url === variant.image);
                            if (imgIdx >= 0) setSelectedImage(imgIdx);
                          }
                        }}
                        disabled={variant.stock === 0}
                        className={cn(
                          "relative flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all duration-200",
                          selectedVariant === variant.id
                            ? "border-secondary bg-secondary !text-white shadow-[0_6px_25px_rgba(192,57,43,0.3)]"
                            : "border-border text-charcoal hover:border-secondary hover:text-secondary",
                          variant.stock === 0 && "opacity-30 cursor-not-allowed line-through"
                        )}
                      >
                        {variant.hex && (
                          <span
                            className={cn("h-4 w-4 rounded-full border-2", selectedVariant === variant.id ? "border-white" : "border-border/50")}
                            style={{ backgroundColor: variant.hex }}
                          />
                        )}
                        {variant.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity + Add to Cart */}
              {product.stock_quantity > 0 ? (
                <>
                  {/* Quantity + Add to Bag */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center h-12 border border-border rounded-full overflow-hidden shrink-0">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="flex items-center justify-center w-11 h-full text-charcoal-lighter hover:text-charcoal hover:bg-pearl transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-10 text-center text-sm font-semibold text-charcoal select-none">{quantity}</span>
                      <button
                        onClick={() => setQuantity(Math.min(10, quantity + 1))}
                        className="flex items-center justify-center w-11 h-full text-charcoal-lighter hover:text-charcoal hover:bg-pearl transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      onClick={handleAddToCart}
                      disabled={addedToCart || variantRequired}
                      className={cn(
                        "flex-1 h-12 rounded-full font-body font-semibold text-[14px] tracking-wide transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                        addedToCart
                          ? "bg-charcoal text-white"
                          : "bg-secondary text-white hover:bg-secondary-dark hover:shadow-[0_6px_30px_rgba(192,57,43,0.4)] hover:-translate-y-[1px]"
                      )}
                    >
                      <AnimatePresence mode="wait">
                        {addedToCart ? (
                          <motion.span key="added" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center justify-center gap-2 text-white">
                            <Check className="h-5 w-5" /> Added to Bag
                          </motion.span>
                        ) : variantRequired ? (
                          <motion.span key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center justify-center gap-2 text-white">
                            <ShoppingBag className="h-5 w-5" /> Select an option
                          </motion.span>
                        ) : (
                          <motion.span key="add" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center justify-center gap-2 text-white">
                            <ShoppingBag className="h-5 w-5" /> Add to Bag
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>

                  {/* Wishlist + Share */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleItem(product.id)}
                      className={cn(
                        "flex items-center gap-2 h-11 px-3 sm:px-5 rounded-full border text-xs sm:text-sm font-medium transition-all duration-200 flex-1 sm:flex-initial justify-center",
                        wishlisted
                          ? "border-secondary bg-secondary/5 text-secondary"
                          : "border-border text-charcoal-light hover:border-charcoal hover:text-charcoal"
                      )}
                    >
                      <Heart className={cn("h-4 w-4 shrink-0", wishlisted && "fill-current")} />
                      <span className="truncate">{wishlisted ? "In Wishlist" : "Add to Wishlist"}</span>
                    </button>
                    <button
                      onClick={handleShare}
                      className={cn(
                        "flex items-center gap-2 h-11 px-3 sm:px-5 rounded-full border text-xs sm:text-sm font-medium transition-all duration-300 shrink-0",
                        shared
                          ? "border-success bg-success text-white"
                          : "border-border text-charcoal-light hover:border-charcoal hover:text-charcoal"
                      )}
                    >
                      {shared ? <><Check className="h-4 w-4" /> <span className="hidden sm:inline">Link Copied!</span><span className="sm:hidden">Copied</span></> : <><Share2 className="h-4 w-4" /> Share</>}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Out of Stock — only wishlist */}
                  <div className="p-4 rounded-xl bg-pearl/80 border border-border/30 text-center">
                    <p className="text-sm font-semibold text-charcoal mb-1">Out of Stock</p>
                    <p className="text-xs text-charcoal-lighter">This product is currently unavailable. Add it to your wishlist to get notified when it&apos;s back.</p>
                  </div>
                  <button
                    onClick={() => toggleItem(product.id)}
                    className={cn(
                      "w-full h-12 rounded-full font-body font-semibold text-[14px] tracking-wide transition-all duration-200 cursor-pointer flex items-center justify-center gap-2",
                      wishlisted
                        ? "bg-secondary text-white hover:bg-secondary-dark"
                        : "bg-secondary text-white hover:bg-secondary-dark hover:shadow-[0_6px_30px_rgba(192,57,43,0.4)] hover:-translate-y-[1px]"
                    )}
                  >
                    <Heart className={cn("h-5 w-5", wishlisted && "fill-current")} />
                    {wishlisted ? "Added to Wishlist" : "Add to Wishlist"}
                  </button>
                  <button
                    onClick={handleShare}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full h-10 rounded-full border text-sm font-medium transition-all duration-300",
                      shared
                        ? "border-success bg-success text-white"
                        : "border-border text-charcoal-light hover:border-charcoal hover:text-charcoal"
                    )}
                  >
                    {shared ? <><Check className="h-4 w-4" /> Link Copied!</> : <><Share2 className="h-4 w-4" /> Share</>}
                  </button>
                </>
              )}

              {/* Stock indicator */}
              {product.stock_quantity > 0 && product.stock_quantity <= 10 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-warning/5 border border-warning/15">
                  <Sparkles className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-xs text-warning font-medium">
                    Only {product.stock_quantity} left — order soon!
                  </span>
                </div>
              )}

              {/* Trust Promises — loaded from settings */}
              <StorefrontTrustBadges badgeIds={product.trust_badges || []} />
            </div>
          </motion.div>
        </div>

        {/* ═══════ PRODUCT DETAILS ACCORDION ═══════ */}
        <div className="mt-16 max-w-3xl">
          <Accordion type="multiple" defaultValue={["description"]} className="space-y-3">
            <AccordionItem value="description" className="border rounded-2xl px-4 sm:px-6 overflow-hidden border-border/30">
              <AccordionTrigger className="text-base font-semibold py-5">Description</AccordionTrigger>
              <AccordionContent className="text-charcoal-light text-[15px] leading-relaxed pb-5">
                {product.description}
                {product.how_to_use && (
                  <div className="mt-5 p-4 rounded-xl bg-pearl/60">
                    <h4 className="font-semibold text-charcoal text-sm mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-secondary" /> How to Use
                    </h4>
                    <p className="text-sm">{product.how_to_use}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="details" className="border rounded-2xl px-4 sm:px-6 overflow-hidden border-border/30">
              <AccordionTrigger className="text-base font-semibold py-5">Product Details</AccordionTrigger>
              <AccordionContent className="pb-5">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                  {[
                    { label: "SKU", value: product.sku },
                    product.weight ? { label: "Weight / Size", value: product.weight } : null,
                    product.country_of_origin ? { label: "Origin", value: `${getCountryFlag(product.country_of_origin)} ${product.country_of_origin}` } : null,
                    { label: "Category", value: product.category_name },
                    product.subcategory ? { label: "Sub-category", value: product.subcategory } : null,
                    { label: "Stock", value: product.stock_quantity > 0 ? `${product.stock_quantity} available` : "Out of stock" },
                  ].filter(Boolean).map((item) => (
                    <div key={item!.label} className="flex justify-between py-2 border-b border-border/20">
                      <span className="text-sm text-charcoal-lighter">{item!.label}</span>
                      <span className="text-sm text-charcoal font-medium">{item!.value}</span>
                    </div>
                  ))}
                </div>
                {product.ingredients && (
                  <div className="mt-5 p-4 rounded-xl bg-pearl/60">
                    <h4 className="font-semibold text-charcoal text-sm mb-2">Ingredients</h4>
                    <p className="text-sm text-charcoal-light">{product.ingredients}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="shipping" className="border rounded-2xl px-4 sm:px-6 overflow-hidden border-border/30">
              <AccordionTrigger className="text-base font-semibold py-5">Shipping & Returns</AccordionTrigger>
              <AccordionContent className="pb-5 text-sm text-charcoal-light space-y-3">
                <div className="flex items-start gap-3">
                  <Truck className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                  <div><span className="font-medium text-charcoal">Inside Dhaka:</span> 1-2 business days. <span className="font-medium text-charcoal">Outside Dhaka:</span> 3-5 business days.</div>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                  <div>Free shipping on orders above <span className="font-medium text-charcoal">৳{free_delivery_threshold.toLocaleString()}</span>. Standard shipping fee: ৳120.</div>
                </div>
                <div className="flex items-start gap-3">
                  <RotateCcw className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                  <div>7-day hassle-free returns for unused, unopened items in original packaging.</div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem id="reviews" value="reviews" className="border rounded-2xl px-4 sm:px-6 overflow-hidden border-border/30">
              <AccordionTrigger className="text-base font-semibold py-5">
                Reviews ({realReviewCount})
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                {/* Success message after submitting */}
                {reviewSuccess && (
                  <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium mb-4">
                    <Check className="h-4 w-4 inline mr-1" /> Thank you! Your review has been submitted and is pending approval.
                  </div>
                )}

                {realReviewCount > 0 ? (
                  <div className="space-y-4">
                    {/* Rating Summary */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-4 sm:p-5 rounded-xl bg-pearl/60">
                      <div className="text-center">
                        <p className="text-3xl sm:text-4xl font-bold text-charcoal">{realAvgRating}</p>
                        <div className="flex items-center gap-0.5 mt-1 justify-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-3.5 w-3.5", i < Math.round(Number(realAvgRating)) ? "text-gold fill-gold" : "text-border")} />
                          ))}
                        </div>
                        <p className="text-xs text-charcoal-lighter mt-1">{realReviewCount} reviews</p>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {ratingDistribution.map(({ stars, pct }) => (
                          <div key={stars} className="flex items-center gap-2">
                            <span className="text-xs text-charcoal-lighter w-3">{stars}</span>
                            <Star className="h-3 w-3 text-gold fill-gold" />
                            <div className="flex-1 h-2 bg-border/30 rounded-full overflow-hidden">
                              <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-charcoal-lighter w-7 text-right">{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Real Reviews */}
                    {productReviews.map((review) => (
                      <div key={review.id} className="p-4 rounded-xl border border-border/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">
                              {review.customer_name?.[0] || "?"}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-charcoal">{review.customer_name}</p>
                                {review.is_verified_purchase && <Badge variant="success" className="text-[8px]">Verified</Badge>}
                              </div>
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, j) => (
                                  <Star key={j} className={cn("h-3 w-3", j < review.rating ? "text-gold fill-gold" : "text-border")} />
                                ))}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-charcoal-lighter">
                            {new Date(review.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        {review.title && <h4 className="text-sm font-medium text-charcoal mb-1">{review.title}</h4>}
                        <p className="text-sm text-charcoal-light">{review.comment}</p>
                        {review.admin_reply && (
                          <div className="mt-3 p-3 rounded-lg bg-primary-light">
                            <p className="text-[10px] font-medium text-secondary mb-0.5">ChineXa Reply</p>
                            <p className="text-xs text-charcoal-light">{review.admin_reply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Star className="h-10 w-10 text-charcoal-lighter/20 mx-auto mb-3" />
                    <p className="text-sm text-charcoal-lighter">No reviews yet. Be the first to review this product!</p>
                  </div>
                )}

                {/* Write Review Form */}
                {!showReviewForm ? (
                  <div className="mt-4 text-center">
                    <Button variant="outline" size="sm" onClick={() => setShowReviewForm(true)}>Write a Review</Button>
                  </div>
                ) : (
                  <div className="mt-4 p-3 sm:p-5 rounded-xl border border-secondary/20 bg-primary-light/30 space-y-4">
                    <h4 className="text-sm font-semibold text-charcoal">Write Your Review</h4>

                    {/* Star selector */}
                    <div>
                      <label className="text-xs font-medium text-charcoal-light mb-1.5 block">Rating</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} type="button" onClick={() => setReviewRating(s)} className="p-1.5">
                            <Star className={cn("h-6 w-6 transition-colors", s <= reviewRating ? "text-gold fill-gold" : "text-border hover:text-gold/50")} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Review title (optional)"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      className="w-full h-10 rounded-xl border border-border bg-white px-3 text-sm text-charcoal placeholder:text-charcoal-lighter/50 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
                    />

                    <Textarea
                      placeholder="Share your experience with this product..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="min-h-[80px]"
                    />

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowReviewForm(false)}>Cancel</Button>
                      <Button variant="secondary" size="sm" onClick={handleSubmitReview} disabled={reviewSubmitting || !reviewComment.trim()}>
                        {reviewSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                        Submit Review
                      </Button>
                    </div>

                    {!authUser && (
                      <p className="text-[10px] text-charcoal-lighter">
                        <Link href="/login" className="text-secondary hover:underline">Sign in</Link> for your review to appear as a verified purchase.
                      </p>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* ═══════ RELATED PRODUCTS ═══════ */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-heading text-2xl font-semibold text-charcoal">You Might Also Like</h3>
              <Link href={`/categories/${product.category_id}`} className="text-sm text-secondary hover:text-secondary-dark flex items-center gap-1 transition-colors">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {relatedProducts.slice(0, 4).map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Image Lightbox ═══ */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Close */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Nav arrows */}
            {product.images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedImage((prev) => (prev + 1) % product.images.length); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            {/* Full-size image */}
            <motion.div
              key={selectedImage}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-[90vw] max-h-[90vh] w-auto h-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={product.images[selectedImage]?.url || ""}
                alt={product.images[selectedImage]?.alt || product.name}
                width={1200}
                height={1500}
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                unoptimized
              />
            </motion.div>

            {/* Dots */}
            {product.images.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1">
                {product.images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setSelectedImage(i); }}
                    className="flex items-center justify-center h-8 w-8"
                    aria-label={`View image ${i + 1}`}
                  >
                    <span className={cn("rounded-full transition-all", i === selectedImage ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/40")} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
