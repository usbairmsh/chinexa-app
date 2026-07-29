import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { Category } from "@/types/category";

// SERVER-rendered category grid — the homepage LCP element. Rendered as HTML in
// the initial response (no client hooks / framer-motion) so the browser can
// paint the "Shop by Category" heading and the first category image immediately
// instead of waiting for the JS bundle to boot. The interactive hover (zoom,
// arrow slide) is pure CSS via the `group` class, so no client JS is needed.
export function CategoryShowcaseServer({ categories }: { categories: Category[] }) {
  const mainCategories = (categories || []).filter((c) => !c.parent_id).slice(0, 7);
  if (mainCategories.length === 0) return null;

  return (
    <section className="py-8 sm:py-10 lg:py-12 bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl sm:text-4xl font-semibold text-charcoal mb-3">
            Shop by Category
          </h2>
          <p className="text-charcoal-lighter max-w-md mx-auto">
            Discover our curated collections crafted for the modern woman
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {mainCategories.map((category, index) => (
            <div key={category.id} className={index === 0 ? "col-span-2 row-span-2" : ""}>
              <Link
                href={`/categories/${category.slug}`}
                className="group relative block overflow-hidden rounded-2xl bg-pearl aspect-[4/5] img-zoom"
              >
                <Image
                  src={category.image || `https://picsum.photos/seed/cat-${category.slug}/600/750`}
                  alt={category.name || "Product category"}
                  fill
                  priority={index === 0}
                  fetchPriority={index === 0 ? "high" : undefined}
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
