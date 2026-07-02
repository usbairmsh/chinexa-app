"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Award } from "lucide-react";

interface BrandItem {
  id: string;
  name: string;
  slug: string;
  logo?: string;
}

export function BrandsMarquee() {
  const [brands, setBrands] = useState<BrandItem[]>([]);

  useEffect(() => {
    fetch("/api/brands?homepage=true")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBrands(data.filter((b: Record<string, unknown>) => b.is_active));
        }
      })
      .catch(() => {});
  }, []);

  if (brands.length === 0) return null;

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mb-2">
            Our Brands
          </h2>
          <p className="text-charcoal-lighter">Trusted brands we carry</p>
        </motion.div>
      </div>

      {/* Marquee */}
      <div className="relative">
        <div className="flex gap-8 animate-marquee items-center">
          {[...brands, ...brands].map((brand, i) => (
            <Link
              key={`${brand.id}-${i}`}
              href={`/brands/${brand.slug}`}
              className="flex-shrink-0 w-40 h-24 rounded-2xl border border-border/30 bg-pearl/50 p-4 flex items-center justify-center hover:border-primary/30 hover:shadow-sm transition-all"
            >
              {brand.logo ? (
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={120}
                  height={60}
                  className="object-contain max-h-14"
                  unoptimized={brand.logo.includes("/uploads/")}
                />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Award className="h-6 w-6 text-charcoal-lighter" />
                  <span className="text-xs font-medium text-charcoal truncate max-w-[100px]">
                    {brand.name}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
