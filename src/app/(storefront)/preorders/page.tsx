"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clock, PackageSearch } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useProducts } from "@/hooks/queries/use-products";
import type { ProductListParams } from "@/types/product";

// Mirrors the /exclusive listing but filters on the `preorder` badge. This is
// the destination for the header "Pre-orders" nav, which previously pointed at
// /categories/pre-orders — a category that never existed, so the item was
// permanently empty.
export default function PreordersPage() {
  const [params, setParams] = useState<ProductListParams>({
    page: 1,
    page_size: 12,
    preorder: true,
    sort_by: "newest",
  });

  const { data, isLoading, isFetching } = useProducts(params);
  const products = data?.data || [];
  const totalPages = data?.total_pages || 1;

  return (
    <div className="bg-card min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-secondary/[0.07] via-white to-primary-light/40 border-b border-border/30">
        <div className="absolute inset-0 opacity-10">
          <Image src="https://picsum.photos/seed/chinexa-preorder-hero/1600/500" alt="" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
          <Breadcrumb items={[{ label: "Pre-orders" }]} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mt-4"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
              <Clock className="h-3.5 w-3.5" /> Reserve now
            </span>
            <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold text-charcoal">Pre-orders</h1>
            <p className="mt-2 max-w-xl text-sm sm:text-base text-charcoal-lighter">
              Reserve upcoming and restocking items now — pay on delivery once your pre-ordered product is in stock and shipped.
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
          <EmptyState icon={PackageSearch} title="No pre-orders available right now" description="Check back soon — items open for pre-order will appear here." />
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
