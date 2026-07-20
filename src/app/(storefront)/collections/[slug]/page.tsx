"use client";

import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { PackageSearch } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useNewArrivals, useBestsellers, useTrendingProducts } from "@/hooks/queries/use-products";

const collectionMeta: Record<string, { title: string; description: string }> = {
  "new-arrivals": {
    title: "New Arrivals",
    description: "The latest additions to our collection — be the first to discover fresh beauty finds.",
  },
  bestsellers: {
    title: "Best Sellers",
    description: "Our most loved products — tried, tested, and adored by the ChineXa community.",
  },
  trending: {
    title: "Trending Now",
    description: "What everyone is talking about — the hottest products of the season.",
  },
};

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: newArrivals, isLoading: loadingNew } = useNewArrivals(24);
  const { data: bestsellers, isLoading: loadingBest } = useBestsellers(24);
  const { data: trending, isLoading: loadingTrending } = useTrendingProducts(24);

  const isKnownCollection = slug in collectionMeta;
  const meta = collectionMeta[slug] || { title: "Collection Not Found", description: "The collection you are looking for does not exist. Browse all products instead." };

  let products: typeof newArrivals = [];
  let isLoading = false;

  if (slug === "new-arrivals") { products = newArrivals; isLoading = loadingNew; }
  else if (slug === "bestsellers") { products = bestsellers; isLoading = loadingBest; }
  else if (slug === "trending") { products = trending; isLoading = loadingTrending; }

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-hero-gradient py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: meta.title }]} />
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal mt-4"
          >
            {meta.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-charcoal-lighter mt-3 max-w-2xl"
          >
            {meta.description}
          </motion.p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-2xl" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {products?.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}

        {products?.length === 0 && !isLoading && (
          <EmptyState
            icon={PackageSearch}
            title={isKnownCollection ? "No products in this collection yet" : "Collection not found"}
            description={
              isKnownCollection
                ? "Check back soon — we're adding new products all the time."
                : "The collection you are looking for does not exist."
            }
            actionLabel="Browse all products"
            actionHref="/products"
          />
        )}
      </div>
    </div>
  );
}
