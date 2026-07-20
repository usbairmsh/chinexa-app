"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Award, Globe } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  country?: string;
  description?: string;
  certifications: string[];
  is_active: boolean;
  product_count: number;
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBrands(data.filter((b: Record<string, unknown>) => b.is_active));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-hero-gradient">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <Breadcrumb items={[{ label: "Brands" }]} />
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold text-charcoal mt-4"
          >
            Our Brands
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-charcoal-lighter mt-3 max-w-2xl"
          >
            Explore our curated collection of trusted brands
          </motion.p>
          <p className="text-sm text-charcoal-lighter mt-2">{brands.length} brands</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No brands available yet"
            description="Check back soon as we continue curating trusted brands for you."
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6"
          >
            {brands.map((brand, index) => (
              <motion.div
                key={brand.id}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={`/brands/${brand.slug}`}
                  className="group block rounded-2xl border border-border/30 bg-white p-5 shadow-card hover:border-primary/30 hover:shadow-luxury-hover hover:-translate-y-px active:scale-[0.98] transition-all duration-300"
                >
                  {/* Logo */}
                  <div className="flex items-center justify-center h-20 mb-4">
                    {brand.logo ? (
                      <Image
                        src={brand.logo}
                        alt={brand.name}
                        width={120}
                        height={80}
                        className="object-contain max-h-20 group-hover:scale-105 transition-transform duration-300"
                        unoptimized={brand.logo.includes("/uploads/")}
                      />
                    ) : (
                      <Award className="h-10 w-10 text-charcoal-lighter" />
                    )}
                  </div>

                  {/* Info */}
                  <h3 className="font-heading text-base font-semibold text-charcoal text-center mb-1 group-hover:text-secondary transition-colors">
                    {brand.name}
                  </h3>

                  {brand.country && (
                    <p className="flex items-center justify-center gap-1 text-xs text-charcoal-lighter mb-2">
                      <Globe className="h-3 w-3" /> {brand.country}
                    </p>
                  )}

                  {brand.description && (
                    <p className="text-xs text-charcoal-lighter text-center line-clamp-2 mb-3">
                      {brand.description}
                    </p>
                  )}

                  {brand.certifications.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mb-2">
                      {brand.certifications.slice(0, 3).map((cert, i) => (
                        <Badge key={i} variant="outline" className="text-[9px]">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-charcoal-lighter text-center">
                    {brand.product_count} {brand.product_count === 1 ? "product" : "products"}
                  </p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
