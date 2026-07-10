"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, ArrowRight, Clock, Sparkles, CornerDownLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/ui.store";
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
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebouncedValue(query, 250);
  const isSubmittable = debouncedQuery.trim().length >= 2;

  const { data: searchData, isFetching: searching } = useSearchProducts(isSubmittable ? debouncedQuery : "", { page_size: 8 });
  const results = useMemo(() => searchData?.data || [], [searchData]);

  const { data: trendingData } = useTrendingSearches();
  const trendingTerms = trendingData?.terms || [];
  const trendingLabel = trendingData?.source === "bestsellers" ? "Best Sellers" : "Trending Now";

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
          {/* Backdrop — a warm blush wash rather than flat charcoal, so the
              scrim itself belongs to this store's palette instead of reading
              as a generic dark-modal overlay. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 backdrop-blur-md"
            style={{ background: "linear-gradient(160deg, rgba(58,36,56,0.55), rgba(122,79,160,0.35))" }}
            onClick={closeOverlay}
          />

          {/* Search Panel — framed like a boutique catalogue card: a gold
              spine along the left edge, serif masthead treatment for the
              query state, editorial rows instead of a bare dropdown list. */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="fixed inset-x-0 top-0 z-50 sm:top-[8vh] sm:left-1/2 sm:-translate-x-1/2 sm:inset-x-auto sm:w-full sm:max-w-[640px]"
          >
            <div className="relative bg-ivory sm:rounded-[20px] shadow-[0_30px_80px_rgba(58,36,56,0.28)] max-h-screen sm:max-h-[78vh] overflow-hidden flex ring-1 ring-black/[0.04]">
              {/* Gold spine — a fixed decorative rail, not a scroll-affected element */}
              <div className="hidden sm:block w-[6px] shrink-0 bg-gradient-to-b from-gold via-gold-light to-gold" />

              <div className="flex-1 min-w-0 flex flex-col">
                {/* Masthead / input row */}
                <div className="relative shrink-0 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-heading text-[11px] tracking-[0.28em] uppercase text-charcoal-lighter">
                      ChineXa Catalogue
                    </p>
                    <button
                      onClick={closeOverlay}
                      className="hidden sm:flex items-center gap-1.5 h-6 px-2 rounded-full border border-border/60 text-[10px] font-medium text-charcoal-lighter hover:border-secondary/40 hover:text-secondary transition-colors"
                    >
                      ESC to close
                    </button>
                    <button
                      onClick={closeOverlay}
                      className="sm:hidden flex items-center justify-center h-8 w-8 rounded-full hover:bg-pearl text-charcoal-lighter shrink-0"
                      aria-label="Close search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-end gap-3">
                    <Search className={cn("h-6 w-6 mb-1 shrink-0 transition-colors duration-200", focused ? "text-secondary" : "text-charcoal-lighter/70")} strokeWidth={1.75} />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder="Serums, K-beauty, tote bags…"
                      className="flex-1 min-w-0 font-heading text-[26px] sm:text-[30px] leading-none text-charcoal placeholder:text-charcoal-lighter/35 outline-none bg-transparent"
                      style={{ textWrap: "balance" }}
                      autoComplete="off"
                    />
                    <AnimatePresence>
                      {query && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                          className="mb-1 p-1.5 rounded-full hover:bg-pearl text-charcoal-lighter shrink-0"
                          aria-label="Clear search"
                        >
                          <X className="h-4 w-4" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Progress hairline — replaces the old pulsing icon; a single
                      quiet signal that a request is in flight. */}
                  <div className="absolute left-0 right-0 bottom-0 h-[2px] overflow-hidden bg-transparent">
                    <AnimatePresence>
                      {searching && (
                        <motion.div
                          key="progress"
                          initial={{ x: "-100%" }}
                          animate={{ x: "100%" }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                          className="h-full w-2/5 bg-secondary"
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Results area */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                  <div className="px-4 sm:px-6 py-4 sm:py-5">
                    {isSubmittable && results.length > 0 && (
                      <div ref={resultsRef}>
                        <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-[0.2em] mb-3 px-1">
                          {searchData?.total ?? results.length} found
                        </p>
                        <div className="space-y-1">
                          {results.map((product, i) => (
                            <motion.div
                              key={product.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.035, duration: 0.35, ease: "easeOut" }}
                            >
                              <Link
                                data-index={i}
                                href={`/products/${product.slug}`}
                                prefetch={false}
                                onClick={() => { rememberSearch(product.name); closeOverlay(); }}
                                onMouseEnter={() => setActiveIndex(i)}
                                className={cn(
                                  "flex items-center gap-4 p-2.5 rounded-2xl transition-colors group border",
                                  activeIndex === i ? "bg-primary-light border-primary-dark/30" : "border-transparent hover:bg-pearl/70"
                                )}
                              >
                                <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-pearl shrink-0 ring-1 ring-black/[0.05]">
                                  <Image
                                    src={product.images[0]?.url || `https://picsum.photos/seed/${product.slug}/100/100`}
                                    alt={product.name}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                                    sizes="56px"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-heading text-[15px] leading-snug text-charcoal group-hover:text-secondary transition-colors truncate">
                                    {product.name}
                                  </p>
                                  <p className="text-[11px] text-charcoal-lighter truncate mt-0.5">{product.category_name}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold text-charcoal">{formatCurrency(product.price)}</p>
                                  {product.compare_at_price && (
                                    <p className="text-[10px] text-charcoal-lighter line-through">{formatCurrency(product.compare_at_price)}</p>
                                  )}
                                </div>
                                {activeIndex === i && <CornerDownLeft className="h-3.5 w-3.5 text-secondary shrink-0" />}
                              </Link>
                            </motion.div>
                          ))}
                        </div>

                        <Link
                          href={`/search?q=${encodeURIComponent(query)}`}
                          onClick={closeOverlay}
                          className="flex items-center justify-center gap-2 mt-3 py-3.5 rounded-2xl bg-charcoal text-sm font-medium text-white hover:bg-secondary transition-colors"
                        >
                          View all results <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}

                    {isSubmittable && searching && results.length === 0 && (
                      <div className="text-center py-16">
                        <p className="font-heading text-sm text-charcoal-lighter italic">Searching the catalogue…</p>
                      </div>
                    )}

                    {isSubmittable && !searching && results.length === 0 && (
                      <div className="text-center py-16 px-4">
                        <p className="font-heading text-lg text-charcoal-light mb-1.5">Nothing found</p>
                        <p className="text-sm text-charcoal-lighter">
                          No matches for &ldquo;<span className="text-charcoal">{query}</span>&rdquo; — try a shorter word or a brand name.
                        </p>
                      </div>
                    )}

                    {!isSubmittable && (
                      <div className="space-y-6 px-1 py-1">
                        {recentSearches.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2.5 px-1">
                              <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-[0.2em] flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> Recent
                              </p>
                              <button onClick={clearRecent} className="text-[10px] text-charcoal-lighter hover:text-secondary transition-colors">
                                Clear
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {recentSearches.map((term, i) => (
                                <motion.button
                                  key={term}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.03 }}
                                  whileHover={{ y: -1 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => setQuery(term)}
                                  className="px-3.5 py-2 rounded-full border border-border/70 bg-white text-xs font-medium text-charcoal-light hover:border-secondary/50 hover:text-secondary transition-colors"
                                >
                                  {term}
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        )}

                        {trendingTerms.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-charcoal-lighter uppercase tracking-[0.2em] flex items-center gap-1.5 mb-2.5 px-1">
                              <Sparkles className="h-3 w-3 text-gold" /> {trendingLabel}
                            </p>
                            {/* "Wax-stamp" treatment: a gold ring badge distinguishes
                                trending picks from the plain recent-search pills above,
                                so the two categories read differently at a glance. */}
                            <div className="flex flex-wrap gap-2">
                              {trendingTerms.map((term, i) => (
                                <motion.button
                                  key={term}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.03 }}
                                  whileHover={{ y: -1 }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => setQuery(term)}
                                  className="relative px-3.5 py-2 pl-4 rounded-full bg-white text-xs font-medium text-charcoal-light capitalize transition-colors hover:text-secondary"
                                  style={{ boxShadow: "inset 0 0 0 1.5px var(--color-gold-light)" }}
                                >
                                  <span
                                    className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-gold"
                                    aria-hidden
                                  />
                                  {term}
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        )}

                        {recentSearches.length === 0 && trendingTerms.length === 0 && (
                          <div className="text-center py-16 px-4">
                            <p className="font-heading text-lg text-charcoal-light mb-1.5">What are you looking for?</p>
                            <p className="text-sm text-charcoal-lighter">Search skincare, bags, jewels, perfumes and more.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
