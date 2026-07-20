"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/storefront/product/product-card";
import { useSearchProducts } from "@/hooks/queries/use-products";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(queryInput, 300);

  // A brand-new search term always starts back at page 1
  useEffect(() => { setPage(1); }, [query]);

  const { data, isLoading, isFetching } = useSearchProducts(query, { page, page_size: PAGE_SIZE });

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-hero-gradient py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumb items={[{ label: "Search" }]} />
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal mt-4 mb-6">
            Search Products
          </h1>
          <div className="max-w-xl">
            <Input
              placeholder="Search for skincare, bags, perfumes..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              icon={<SearchIcon className="h-4 w-4" />}
              className="bg-white h-12 text-base rounded-luxury"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {query.length < 2 ? (
          <EmptyState
            icon={SearchIcon}
            title="Start typing to search"
            description="Type at least 2 characters to search our full catalog of skincare, bags, perfumes, and more."
          />
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-2xl" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className={cn("text-sm text-charcoal-lighter mb-6 transition-opacity duration-200 ease-out", isFetching && "opacity-60")}>
              <span className="font-semibold text-charcoal text-base">{data?.total || 0}</span> results for &ldquo;<span className="font-medium text-charcoal">{query}</span>&rdquo;
            </p>
            {data && data.data.length > 0 ? (
              <>
                <motion.div
                  key={`${query}-${page}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6"
                >
                  {data.data.map((product, i) => (
                    <ProductCard key={product.id} product={product} index={i} />
                  ))}
                </motion.div>
                {data.total_pages > 1 && (
                  <div className="mt-10 flex justify-center">
                    <Pagination currentPage={page} totalPages={data.total_pages} onPageChange={setPage} />
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={SearchIcon}
                title="No products found"
                description={`We couldn't find anything for "${query}". Try a different search term.`}
                actionLabel="Browse All Products"
                actionHref="/products"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SearchContent />
    </Suspense>
  );
}
