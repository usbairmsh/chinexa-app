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
  const [mounted, setMounted] = useState(false);

  // The wishlist store is persisted to localStorage — `items` starts empty
  // and only reflects the real saved list after client-side rehydration.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (items.length === 0) { setProducts([]); setLoading(false); return; }

    // Guard against overlapping runs (React Strict Mode double-invoke, or
    // `items` changing again before the previous fetch resolves) — without
    // this, a stale/earlier request can resolve last and overwrite the
    // correct product list with empty results.
    let cancelled = false;
    setLoading(true);

    fetch(`/api/products?ids=${items.map(encodeURIComponent).join(",")}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .catch(() => ({ data: [] }))
      .then((res) => {
        if (cancelled) return;
        setProducts(Array.isArray(res.data) ? (res.data as Product[]) : []);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [mounted, items]);

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
