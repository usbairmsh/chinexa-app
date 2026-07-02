"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Award } from "lucide-react";

interface BrandItem {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  country?: string;
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

  // Repeat brands enough times so the marquee fills the screen seamlessly
  const repeatedBrands = useMemo(() => {
    if (brands.length === 0) return [];
    const minItems = Math.max(10, brands.length * 2);
    const repeats = Math.ceil(minItems / brands.length);
    const items: BrandItem[] = [];
    for (let r = 0; r < repeats; r++) {
      items.push(...brands);
    }
    return items;
  }, [brands]);

  if (brands.length === 0) return null;

  // Duration scales with number of unique brands for consistent speed
  const duration = Math.max(20, brands.length * 5);

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
        <div
          className="flex gap-6 items-stretch"
          style={{
            animation: `marquee ${duration}s linear infinite`,
            width: "max-content",
          }}
        >
          {/* Two identical sets for seamless loop */}
          {[...repeatedBrands, ...repeatedBrands].map((brand, i) => (
            <Link
              key={`${brand.id}-${i}`}
              href={`/brands/${brand.slug}`}
              className="flex-shrink-0 w-44 rounded-2xl border border-border/30 bg-pearl/50 p-4 flex flex-col items-center justify-center gap-2 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              {brand.logo ? (
                <div className="h-14 flex items-center justify-center">
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    width={120}
                    height={56}
                    className="object-contain max-h-14"
                    unoptimized={brand.logo.includes("/uploads/")}
                  />
                </div>
              ) : (
                <div className="h-14 flex items-center justify-center">
                  <Award className="h-8 w-8 text-charcoal-lighter" />
                </div>
              )}
              <div className="text-center w-full">
                <p className="text-xs font-semibold text-charcoal truncate">{brand.name}</p>
                {brand.description && (
                  <p className="text-[10px] text-charcoal-lighter truncate mt-0.5">{brand.description}</p>
                )}
                {!brand.description && brand.country && (
                  <p className="text-[10px] text-charcoal-lighter truncate mt-0.5">{brand.country}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
