"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/storefront/product/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types/product";

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  products?: Product[];
  isLoading?: boolean;
  viewAllHref?: string;
  viewAllLabel?: string;
  columns?: 2 | 3 | 4;
}

export function ProductSection({
  title,
  subtitle,
  products,
  isLoading,
  viewAllHref,
  viewAllLabel = "View All",
  columns = 4,
}: ProductSectionProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-semibold text-charcoal mb-1">
              {title}
            </h2>
            {subtitle && (
              <p className="text-charcoal-lighter text-sm sm:text-base">{subtitle}</p>
            )}
          </div>
          {viewAllHref && (
            <Link href={viewAllHref} className="hidden sm:flex">
              <Button variant="ghost" className="gap-1">
                {viewAllLabel} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </motion.div>

        {isLoading ? (
          <div className={`grid ${gridCols[columns]} gap-4 lg:gap-6`}>
            {Array.from({ length: columns * 2 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-2xl" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid ${gridCols[columns]} gap-4 lg:gap-6`}>
            {products?.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}

        {viewAllHref && (
          <div className="mt-8 text-center sm:hidden">
            <Link href={viewAllHref}>
              <Button variant="outline" className="gap-1">
                {viewAllLabel} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
