"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, PackageSearch } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useProducts } from "@/hooks/queries/use-products";
import type { ProductListParams } from "@/types/product";

export default function ExclusivePage() {
  const [params, setParams] = useState<ProductListParams>({
    page: 1,
    page_size: 12,
    exclusive: true,
    sort_by: "restocked",
  });

  const { data, isLoading, isFetching } = useProducts(params);
  const products = data?.data || [];
  const totalPages = data?.total_pages || 1;

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-secondary/[0.07] via-white to-primary-light/40 border-b border-border/30">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
          <Breadcrumb items={[{ label: "Exclusive" }]} />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mt-4"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
              <Sparkles className="h-3.5 w-3.5" /> Fresh & Restocked
            </span>
            <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold text-charcoal">Exclusive</h1>
            <p className="mt-2 max-w-xl text-sm sm:text-base text-charcoal-lighter">
              Just added and freshly restocked — the newest arrivals and back-in-stock favourites, sorted by what landed most recently.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Products */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-charcoal-lighter">
            {data?.total ? <><span className="font-semibold text-charcoal [font-variant-numeric:tabular-nums]">{data.total}</span> item{data.total === 1 ? "" : "s"}</> : ""}
          </p>
          <Select value={params.sort_by} onValueChange={(v) => setParams((p) => ({ ...p, sort_by: v as ProductListParams["sort_by"], page: 1 }))}>
            <SelectTrigger className="w-[190px] h-10"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="restocked">Recently added / restocked</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] rounded-2xl" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState icon={PackageSearch} title="Nothing new right now" description="Check back soon — freshly added and restocked products will appear here." />
        ) : (
          <>
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
              {products.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} priority={i === 0} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-10 flex justify-center">
                <Pagination currentPage={params.page || 1} totalPages={totalPages} onPageChange={(page) => setParams((p) => ({ ...p, page }))} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
