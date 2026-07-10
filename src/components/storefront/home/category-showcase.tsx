"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCategories } from "@/hooks/queries/use-categories";
import { ArrowRight } from "lucide-react";

export function CategoryShowcase() {
  const { data: categories, isLoading } = useCategories();
  const mainCategories = categories?.filter((c) => !c.parent_id).slice(0, 7) || [];

  return (
    <section className="py-8 sm:py-10 lg:py-12 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mb-3">
            Shop by Category
          </h2>
          <p className="text-charcoal-lighter max-w-md mx-auto">
            Discover our curated collections crafted for the modern woman
          </p>
        </motion.div>

        {isLoading && mainCategories.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-2xl bg-pearl animate-pulse aspect-[4/5] ${i === 0 ? "col-span-2 row-span-2" : ""}`}
              />
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {mainCategories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={index === 0 ? "col-span-2 row-span-2" : ""}
            >
              <Link
                href={`/categories/${category.slug}`}
                className="group relative block overflow-hidden rounded-2xl bg-pearl aspect-[4/5] img-zoom"
              >
                <Image
                  src={category.image || `https://picsum.photos/seed/cat-${category.slug}/600/750`}
                  alt={category.name}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes={index === 0 ? "(max-width: 640px) 100vw, 50vw" : "(max-width: 640px) 50vw, 25vw"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6">
                  <h3 className="font-heading text-lg lg:text-xl font-semibold text-white mb-1">
                    {category.name}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-white/80 group-hover:text-white transition-colors">
                    <span>{category.product_count} Products</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        )}
      </div>
    </section>
  );
}
