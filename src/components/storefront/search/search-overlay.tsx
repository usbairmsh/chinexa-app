"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, ArrowRight, Clock, TrendingUp, Loader2, CornerDownLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/ui.store";
import { useCategories } from "@/hooks/queries/use-categories";
import { useSearchProducts } from "@/hooks/queries/use-products";
import { useTrendingSearches } from "@/hooks/queries/use-trending-searches";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCurrency, cn } from "@/lib/utils";

const RECENT_KEY = "chinexa-recent-searches";

export function SearchOverlay() {
  const { searchOverlayOpen, setSearchOverlayOpen } = useUIStore();
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 250);
  const isSubmittable = debouncedQuery.trim().length >= 2;

  const { data: searchData, isFetching: searching } = useSearchProducts(isSubmittable ? debouncedQuery : "", { page_size: 8 });
  const results = useMemo(() => searchData?.data || [], [searchData]);

  const { data: categoriesData } = useCategories();
  const popularCategories = useMemo(() => (categoriesData || []).slice(0, 4), [categoriesData]);

  const { data: trendingData } = useTrendingSearches();
  const trendingTerms = trendingData?.terms || [];

  useEffect(() => {
    if (searchOverlayOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      try {
        const saved = localStorage.getItem(RECENT_KEY);
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch {}
    } else {
      setQuery("");
      setActiveIndex(-1);
    }
  }, [searchOverlayOpen]);

  useEffect(() => {
    if (searchOverlayOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [searchOverlayOpen]);

  useEffect(() => { setActiveIndex(-1); }, [results]);

  const rememberSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch {}
  };

  const clearRecent = () => {
    setRecentSearches([]);
    try { localStorage.removeItem(RECENT_KEY); } catch {}
  };

  const closeOverlay = () => setSearchOverlayOpen(false);

  // Keyboard: Escape closes, Up/Down move through live results, Enter opens
  // the highlighted result (or the "view all" destination if none highlighted).
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!searchOverlayOpen) return;
      if (e.key === "Escape") { closeOverlay(); return; }
      if (!results.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const product = results[activeIndex];
        rememberSearch(product.name);
        closeOverlay();
        window.location.href = `/products/${product.slug}`;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOverlayOpen, results, activeIndex]);

  useEffect(() => {
    if (activeIndex < 0) return;
    resultsRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

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
            className="fixed inset-0 z-50 bg-charcoal/60 backdrop-blur-md"
            onClick={closeOverlay}
          />

          {/* Search Panel */}
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed inset-x-0 top-0 z-50 sm:top-6 sm:left-1/2 sm:-translate-x-1/2 sm:inset-x-auto sm:w-full sm:max-w-2xl"
          >
            <div className="bg-white sm:rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.22)] max-h-screen sm:max-h-[80vh] overflow-hidden flex flex-col ring-1 ring-black/[0.03]">
              {/* Input */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "flex items-center gap-3 h-16 px-5 border-b transition-colors",
                    query ? "border-border/30" : "border-transparent"
                  )}
                >
                  <Search className="h-5 w-5 text-secondary shrink-0" strokeWidth={2.25} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for products, brands, categories..."
                    className="flex-1 h-full text-[15px] font-medium text-charcoal placeholder:text-charcoal-lighter/60 placeholder:font-normal outline-none bg-transparent"
                    autoComplete="off"
                  />
                  {query && (
                    <button
                      onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                      className="p-1.5 rounded-full hover:bg-pearl text-charcoal-lighter shrink-0"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={closeOverlay}
                    className="hidden sm:flex items-center gap-1 h-7 px-2 rounded-md border border-border/40 text-[10px] font-medium text-charcoal-lighter shrink-0"
                  >
                    ESC
                  </button>
                  <button
                    onClick={closeOverlay}
                    className="sm:hidden flex items-center justify-center h-9 w-9 rounded-full hover:bg-pearl text-charcoal-lighter shrink-0"
                    aria-label="Close search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Results Area */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="p-3 sm:p-4">
                  {isSubmittable && results.length > 0 && (
                    <div ref={resultsRef}>
                      <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-widest mb-2 px-2">
                        {searchData?.total ?? results.length} result{(searchData?.total ?? results.length) !== 1 ? "s" : ""}
                      </p>
                      <div className="space-y-0.5">
                        {results.map((product, i) => (
                          <Link
                            key={product.id}
                            data-index={i}
                            href={`/products/${product.slug}`}
                            onClick={() => { rememberSearch(product.name); closeOverlay(); }}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={cn(
                              "flex items-center gap-3.5 p-2.5 rounded-xl transition-colors group",
                              activeIndex === i ? "bg-primary-light" : "hover:bg-pearl/70"
                            )}
                          >
                            <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-pearl shrink-0 ring-1 ring-black/[0.04]">
                              <Image
                                src={product.images[0]?.url || `https://picsum.photos/seed/${product.slug}/100/100`}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-charcoal group-hover:text-secondary transition-colors truncate">
                                {product.name}
                              </p>
                              <p className="text-[11px] text-charcoal-lighter truncate">{product.category_name}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-charcoal">{formatCurrency(product.price)}</p>
                              {product.compare_at_price && (
                                <p className="text-[10px] text-charcoal-lighter line-through">{formatCurrency(product.compare_at_price)}</p>
                              )}
                            </div>
                            {activeIndex === i && <CornerDownLeft className="h-3.5 w-3.5 text-secondary shrink-0" />}
                          </Link>
                        ))}
                      </div>

                      <Link
                        href={`/search?q=${encodeURIComponent(query)}`}
                        onClick={closeOverlay}
                        className="flex items-center justify-center gap-2 mt-2 py-3 rounded-xl bg-charcoal text-sm font-medium text-white hover:bg-secondary transition-colors"
                      >
                        View all results <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}

                  {isSubmittable && searching && results.length === 0 && (
                    <div className="text-center py-14">
                      <Loader2 className="h-6 w-6 text-secondary/60 mx-auto animate-spin" />
                    </div>
                  )}

                  {isSubmittable && !searching && results.length === 0 && (
                    <div className="text-center py-14 px-4">
                      <Search className="h-9 w-9 text-charcoal-lighter/25 mx-auto mb-3" />
                      <p className="text-sm text-charcoal-lighter">
                        No results for &ldquo;<span className="font-medium text-charcoal">{query}</span>&rdquo;
                      </p>
                    </div>
                  )}

                  {!isSubmittable && (
                    <div className="space-y-5 px-1 py-1">
                      {recentSearches.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2 px-1">
                            <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-widest flex items-center gap-1.5">
                              <Clock className="h-3 w-3" /> Recent
                            </p>
                            <button onClick={clearRecent} className="text-[10px] text-charcoal-lighter hover:text-secondary transition-colors">
                              Clear
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {recentSearches.map((term) => (
                              <button
                                key={term}
                                onClick={() => setQuery(term)}
                                className="px-3.5 py-2 rounded-full bg-pearl text-xs font-medium text-charcoal hover:bg-primary-light hover:text-secondary transition-colors"
                              >
                                {term}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {trendingTerms.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-widest flex items-center gap-1.5 mb-2 px-1">
                            <TrendingUp className="h-3 w-3" /> Trending Now
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {trendingTerms.map((term) => (
                              <button
                                key={term}
                                onClick={() => setQuery(term)}
                                className="px-3.5 py-2 rounded-full border border-border/40 text-xs font-medium text-charcoal-light hover:border-secondary hover:text-secondary hover:bg-primary-light transition-all capitalize"
                              >
                                {term}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {popularCategories.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-widest mb-2 px-1">
                            Shop by Category
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {popularCategories.map((cat) => (
                              <Link
                                key={cat.id}
                                href={`/categories/${cat.slug}`}
                                onClick={closeOverlay}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-pearl/70 transition-colors group text-center"
                              >
                                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-pearl shrink-0 ring-1 ring-black/[0.04]">
                                  {cat.image ? (
                                    <Image src={cat.image} alt={cat.name} fill className="object-cover" sizes="48px" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-secondary font-heading font-semibold">
                                      {cat.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs font-medium text-charcoal group-hover:text-secondary transition-colors leading-tight">{cat.name}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
