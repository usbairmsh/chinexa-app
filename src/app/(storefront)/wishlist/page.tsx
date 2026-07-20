"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useWishlistStore } from "@/stores/wishlist.store";
import type { Product } from "@/types/product";

export default function WishlistPage() {
  const { items } = useWishlistStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

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

  const count = mounted ? items.length : 0;

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-hero-gradient py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "Wishlist" }]} />
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mt-4">
            My Wishlist
          </h1>
          <p className="text-charcoal-lighter mt-2">
            <span className="font-semibold text-charcoal">{count}</span> saved item{count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: Math.min(count, 8) || 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-2xl" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Save products you love and they'll appear here. Start browsing our collection!"
            actionLabel="Explore Products"
            actionHref="/products"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6"
          >
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
