"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useUIStore } from "@/stores/ui.store";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product } from "@/types/product";

interface ProductCardListProps {
  product: Product;
  index?: number;
}

export function ProductCardList({ product, index = 0 }: ProductCardListProps) {
  const router = useRouter();
  const addToCart = useCartStore((s) => s.addItem);
  const { toggleItem, isInWishlist } = useWishlistStore();
  const setCartDrawerOpen = useUIStore((s) => s.setCartDrawerOpen);
  const [mounted, setMounted] = useState(false);
  const wishlisted = mounted && isInWishlist(product.id);

  const hasVariants = product.variants.length > 0;

  useEffect(() => setMounted(true), []);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // A variant must be selected — send the customer to the product page to choose.
    if (hasVariants) {
      router.push(`/products/${product.slug}`);
      return;
    }
    addToCart({
      id: "",
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image: product.images[0]?.url || "",
      price: product.price,
      compare_at_price: product.compare_at_price,
      quantity: 1,
      stock: product.stock_quantity,
    });
    setCartDrawerOpen(true);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        href={`/products/${product.slug}`}
        className="group flex gap-4 sm:gap-6 p-3 rounded-2xl border border-border/20 bg-white hover:shadow-card-hover transition-all duration-200"
      >
        {/* Image */}
        <div className="relative h-36 w-28 sm:h-44 sm:w-36 rounded-xl overflow-hidden bg-pearl shrink-0">
          <Image
            src={product.images[0]?.url || `https://picsum.photos/seed/${product.slug}/300/375`}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="144px"
          />
          {product.badges.length > 0 && (
            <div className="absolute top-2 left-2">
              <Badge variant={product.badges[0]} className="text-[8px] uppercase tracking-wider">
                {product.badges[0] === "preorder" ? "Pre-order" : product.badges[0]}
              </Badge>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 py-1 flex flex-col">
          <p className="text-[10px] text-charcoal-lighter uppercase tracking-widest">
            {product.category_name}
          </p>
          <h3 className="text-sm sm:text-base font-semibold text-charcoal group-hover:text-secondary transition-colors mt-0.5 line-clamp-2">
            {product.name}
          </h3>

          {/* Rating */}
          {product.average_rating > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn("h-3 w-3", i < Math.round(product.average_rating) ? "text-gold fill-gold" : "text-border")}
                  />
                ))}
              </div>
              <span className="text-[10px] text-charcoal-lighter">({product.review_count})</span>
            </div>
          )}

          <p className="text-xs text-charcoal-lighter mt-1.5 line-clamp-2 hidden sm:block">
            {product.short_description}
          </p>

          {/* Price + Actions — pushed to bottom */}
          <div className="mt-auto pt-3 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-base sm:text-lg font-bold text-charcoal">
                {formatCurrency(product.price)}
              </span>
              {product.compare_at_price && (
                <span className="text-xs text-charcoal-lighter line-through">
                  {formatCurrency(product.compare_at_price)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleWishlist}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200",
                  wishlisted
                    ? "border-secondary bg-secondary text-white"
                    : "border-border text-charcoal-lighter hover:border-charcoal hover:text-charcoal"
                )}
                aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              >
                <Heart className={cn("h-4 w-4", wishlisted && "fill-current")} />
              </button>

              {product.stock_quantity > 0 && (
                <button
                  onClick={handleAddToCart}
                  className="flex h-9 items-center gap-1.5 px-4 rounded-full bg-secondary font-body text-[12px] font-semibold tracking-wide hover:bg-secondary-dark hover:shadow-[0_6px_30px_rgba(192,57,43,0.4)] hover:-translate-y-[1px] active:scale-[0.96] transition-all duration-300 !text-white"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{hasVariants ? "Select Options" : "Add to Bag"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
