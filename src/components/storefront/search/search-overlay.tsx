"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, ArrowRight, Clock, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/ui.store";
import { products } from "@/data/seed/products";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product } from "@/types/product";

const trendingSearches = ["Serum", "Leather Bag", "Perfume", "Korean Skincare", "Necklace", "Heels"];

export function SearchOverlay() {
  const { searchOverlayOpen, setSearchOverlayOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (searchOverlayOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Load recent searches from localStorage
      try {
        const saved = localStorage.getItem("chinexa-recent-searches");
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch {}
    } else {
      setQuery("");
      setResults([]);
    }
  }, [searchOverlayOpen]);

  // Lock body scroll
  useEffect(() => {
    if (searchOverlayOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [searchOverlayOpen]);

  // Live search
  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const lower = q.toLowerCase();
    const matched = products
      .filter(
        (p) =>
          p.is_active &&
          (p.name.toLowerCase().includes(lower) ||
            p.category_name.toLowerCase().includes(lower) ||
            p.tags.some((t) => t.includes(lower)) ||
            p.subcategory?.toLowerCase().includes(lower))
      )
      .slice(0, 8);
    setResults(matched);
  }, []);

  // Save to recent searches and navigate
  const handleSelect = (product: Product) => {
    const updated = [product.name, ...recentSearches.filter((s) => s !== product.name)].slice(0, 5);
    setRecentSearches(updated);
    try { localStorage.setItem("chinexa-recent-searches", JSON.stringify(updated)); } catch {}
    setSearchOverlayOpen(false);
  };

  const handleTrendingClick = (term: string) => {
    setQuery(term);
    handleSearch(term);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    handleSearch(term);
  };

  const clearRecent = () => {
    setRecentSearches([]);
    try { localStorage.removeItem("chinexa-recent-searches"); } catch {}
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOverlayOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [setSearchOverlayOpen]);

  return (
    <AnimatePresence>
      {searchOverlayOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-charcoal/50 backdrop-blur-sm"
            onClick={() => setSearchOverlayOpen(false)}
          />

          {/* Search Panel — drops from top */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 right-0 z-50 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Search Input */}
            <div className="border-b border-border/20">
              <div className="mx-auto max-w-3xl px-4 sm:px-6 flex items-center gap-3 h-16">
                <Search className="h-5 w-5 text-charcoal-lighter shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search products, categories, brands..."
                  className="flex-1 h-full text-base text-charcoal placeholder:text-charcoal-lighter/50 outline-none bg-transparent"
                  autoComplete="off"
                />
                {query && (
                  <button
                    onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                    className="p-1.5 rounded-full hover:bg-pearl text-charcoal-lighter"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setSearchOverlayOpen(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-pearl text-charcoal-lighter hover:text-charcoal transition-colors ml-1"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4">

                {/* Live Results */}
                {query.length >= 2 && results.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-widest mb-3">
                      {results.length} result{results.length > 1 ? "s" : ""} for &ldquo;{query}&rdquo;
                    </p>
                    <div className="space-y-1">
                      {results.map((product, i) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <Link
                            href={`/products/${product.slug}`}
                            onClick={() => handleSelect(product)}
                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-primary-light transition-colors group"
                          >
                            <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-pearl shrink-0">
                              <Image
                                src={product.images[0]?.url || `https://picsum.photos/seed/${product.slug}/100/100`}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors truncate">
                                {product.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-charcoal-lighter">{product.category_name}</span>
                                {product.average_rating > 0 && (
                                  <span className="text-[10px] text-gold">
                                    {"★".repeat(Math.round(product.average_rating))} {product.average_rating}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-charcoal">{formatCurrency(product.price)}</p>
                              {product.compare_at_price && (
                                <p className="text-[10px] text-charcoal-lighter line-through">{formatCurrency(product.compare_at_price)}</p>
                              )}
                            </div>
                            <ArrowRight className="h-4 w-4 text-charcoal-lighter opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </Link>
                        </motion.div>
                      ))}
                    </div>

                    {/* View All Link */}
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}`}
                      onClick={() => setSearchOverlayOpen(false)}
                      className="flex items-center justify-center gap-2 mt-4 py-3 rounded-xl border border-border/30 text-sm font-medium text-secondary hover:bg-primary-light transition-colors"
                    >
                      View all results for &ldquo;{query}&rdquo; <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                )}

                {/* No Results */}
                {query.length >= 2 && results.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="h-10 w-10 text-charcoal-lighter/30 mx-auto mb-3" />
                    <p className="text-sm text-charcoal-lighter">
                      No products found for &ldquo;<span className="font-medium text-charcoal">{query}</span>&rdquo;
                    </p>
                    <p className="text-xs text-charcoal-lighter mt-1">Try a different search term</p>
                  </div>
                )}

                {/* Default State: Recent + Trending */}
                {query.length < 2 && (
                  <div className="space-y-6">
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-widest flex items-center gap-1.5">
                            <Clock className="h-3 w-3" /> Recent Searches
                          </p>
                          <button onClick={clearRecent} className="text-[10px] text-charcoal-lighter hover:text-secondary transition-colors">
                            Clear all
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {recentSearches.map((term) => (
                            <button
                              key={term}
                              onClick={() => handleRecentClick(term)}
                              className="px-3 py-1.5 rounded-full bg-pearl text-xs text-charcoal hover:bg-primary-light hover:text-secondary transition-colors"
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trending */}
                    <div>
                      <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <TrendingUp className="h-3 w-3" /> Trending Searches
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trendingSearches.map((term) => (
                          <button
                            key={term}
                            onClick={() => handleTrendingClick(term)}
                            className="px-3 py-1.5 rounded-full border border-border/30 text-xs text-charcoal-light hover:border-secondary hover:text-secondary hover:bg-primary-light transition-all"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Categories */}
                    <div>
                      <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-widest mb-2">
                        Popular Categories
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { name: "Skincare", slug: "skincare", img: "https://picsum.photos/seed/cat-skincare/100/100" },
                          { name: "Bags", slug: "bags", img: "https://picsum.photos/seed/cat-bags/100/100" },
                          { name: "Perfumes", slug: "perfumes", img: "https://picsum.photos/seed/cat-perfumes/100/100" },
                          { name: "Jewels", slug: "jewels", img: "https://picsum.photos/seed/cat-jewels/100/100" },
                        ].map((cat) => (
                          <Link
                            key={cat.slug}
                            href={`/categories/${cat.slug}`}
                            onClick={() => setSearchOverlayOpen(false)}
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-light transition-colors group"
                          >
                            <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-pearl shrink-0">
                              <Image src={cat.img} alt={cat.name} fill className="object-cover" sizes="40px" />
                            </div>
                            <span className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors">{cat.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
