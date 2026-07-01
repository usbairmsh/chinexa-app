"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useWishlistStore } from "@/stores/wishlist.store";
import type { Product } from "@/types/product";

export default function AccountWishlistPage() {
  const { items } = useWishlistStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (items.length === 0) { setLoading(false); return; }
    // Fetch each wishlist product from the API
    Promise.all(
      items.map((id) =>
        fetch(`/api/products/${id}`)
          .then((r) => r.json())
          .then((data) => (data && !data.error ? data : null))
          .catch(() => null)
      )
    ).then((results) => {
      setProducts(results.filter(Boolean) as Product[]);
    }).finally(() => setLoading(false));
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-charcoal">My Wishlist</h2>
        <p className="text-xs text-charcoal-lighter">{items.length} item{items.length !== 1 ? "s" : ""}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-charcoal-lighter" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart icon on any product to save it here for later."
          actionLabel="Browse Products"
          actionHref="/products"
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-4"
        >
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
