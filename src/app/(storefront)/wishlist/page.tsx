"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
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
    if (!mounted || items.length === 0) { setLoading(false); return; }
    // Fetch each wishlisted product from API
    Promise.all(
      items.map((id) =>
        fetch(`/api/products/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      setProducts(results.filter(Boolean) as Product[]);
      setLoading(false);
    });
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
          <p className="text-charcoal-lighter mt-2">{count} saved items</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-secondary animate-spin" />
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
