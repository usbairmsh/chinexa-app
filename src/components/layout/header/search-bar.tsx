"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, X, Clock, TrendingUp } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSearchProducts } from "@/hooks/queries/use-products";
import { useTrendingSearches } from "@/hooks/queries/use-trending-searches";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIconPlay } from "@/hooks/use-icon-play";
import { formatCurrency, cn } from "@/lib/utils";

const RECENT_KEY = "chinexa-recent-searches";

function useSearchState() {
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(query, 250);
  const isSubmittable = debouncedQuery.trim().length >= 2;

  const { data: searchData, isFetching: searching } = useSearchProducts(isSubmittable ? debouncedQuery : "", { page_size: 6 });
  const results = useMemo(() => searchData?.data || [], [searchData]);

  const { data: trendingData } = useTrendingSearches();
  const trendingTerms = trendingData?.terms || [];

  useEffect(() => { setActiveIndex(-1); }, [results]);

  const loadRecent = () => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
  };

  const rememberSearch = (term: string) => {
    setRecentSearches((prev) => {
      const updated = [term, ...prev.filter((s) => s !== term)].slice(0, 5);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const clearRecent = () => {
    setRecentSearches([]);
    try { localStorage.removeItem(RECENT_KEY); } catch {}
  };

  /** Arrow keys move through live results; Enter navigates to the
   * highlighted one. Wire to the input's onKeyDown; caller supplies what to
   * do on Enter (navigate + close). */
  const handleKeyDown = (e: React.KeyboardEvent, onEnter: (slug: string) => void) => {
    if (results.length === 0) return;
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
      onEnter(product.slug);
    }
  };

  return {
    query, setQuery, recentSearches, loadRecent, rememberSearch, clearRecent,
    activeIndex, setActiveIndex, isSubmittable, results, searching, handleKeyDown,
    total: searchData?.total ?? results.length, trendingTerms,
  };
}

type SearchState = ReturnType<typeof useSearchState>;

function SuggestionChips({ state }: { state: SearchState }) {
  const { recentSearches, clearRecent, trendingTerms, setQuery } = state;
  if (recentSearches.length === 0 && trendingTerms.length === 0) {
    return <p className="text-sm text-charcoal-lighter px-1 py-2">Search for products, categories, or brands.</p>;
  }
  return (
    <div className="space-y-4">
      {recentSearches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-medium text-charcoal-lighter flex items-center gap-1.5"><Clock className="h-3 w-3" /> Recent</span>
            <button onClick={clearRecent} className="text-[11px] text-charcoal-lighter hover:text-secondary transition-colors active:scale-95">Clear</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((term) => (
              <motion.button key={term} whileTap={{ scale: 0.94 }} onClick={() => setQuery(term)} className="px-3 py-1.5 rounded-full bg-pearl text-xs text-charcoal-light hover:bg-primary-light transition-colors">
                {term}
              </motion.button>
            ))}
          </div>
        </div>
      )}
      {trendingTerms.length > 0 && (
        <div>
          <span className="text-[11px] font-medium text-charcoal-lighter flex items-center gap-1.5 mb-2 px-1"><TrendingUp className="h-3 w-3" /> Trending</span>
          <div className="flex flex-wrap gap-1.5">
            {trendingTerms.map((term) => (
              <motion.button key={term} whileTap={{ scale: 0.94 }} onClick={() => setQuery(term)} className="px-3 py-1.5 rounded-full bg-pearl text-xs text-charcoal-light capitalize hover:bg-primary-light transition-colors">
                {term}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ product, active, onNavigate }: { product: { id: string; slug: string; name: string; category_name: string; price: number; compare_at_price?: number; images: { url: string }[] }; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      prefetch={false}
      onClick={onNavigate}
      data-index={product.id}
      className={cn("group flex items-center gap-3 p-2 rounded-xl transition-colors", active ? "bg-pearl" : "hover:bg-pearl/60")}
    >
      <div className="relative h-11 w-11 rounded-lg overflow-hidden bg-pearl shrink-0">
        <Image src={product.images[0]?.url || `https://picsum.photos/seed/${product.slug}/100/100`} alt={product.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" sizes="44px" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-charcoal truncate">{product.name}</p>
        <p className="text-[11px] text-charcoal-lighter truncate">{product.category_name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium text-charcoal">{formatCurrency(product.price)}</p>
        {product.compare_at_price && <p className="text-[10px] text-charcoal-lighter line-through">{formatCurrency(product.compare_at_price)}</p>}
      </div>
    </Link>
  );
}

function ResultsList({ state, onNavigate }: { state: SearchState; onNavigate: () => void }) {
  const { query, isSubmittable, results, searching, total, activeIndex } = state;

  if (!isSubmittable) return <SuggestionChips state={state} />;

  if (searching && results.length === 0) {
    return (
      <div className="space-y-2 px-1 py-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="h-11 w-11 rounded-lg bg-pearl animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 rounded bg-pearl animate-pulse" />
              <div className="h-2.5 w-1/3 rounded bg-pearl animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-sm text-charcoal-light">No results for &ldquo;{query}&rdquo;</p>
        <p className="text-xs text-charcoal-lighter mt-1">Try a different word or a brand name.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-0.5">
        {results.map((product) => (
          <ResultRow key={product.id} product={product} active={activeIndex >= 0 && results[activeIndex]?.id === product.id} onNavigate={onNavigate} />
        ))}
      </div>
      <Link
        href={`/search?q=${encodeURIComponent(query)}`}
        onClick={onNavigate}
        className="block mt-2 py-2.5 text-center rounded-xl text-sm font-medium text-secondary hover:bg-pearl/60 transition-colors"
      >
        View all {total} results
      </Link>
    </div>
  );
}

/** Desktop: compact pill trigger that expands into itself, with results
 * dropped in an anchored panel below — the surrounding header (logo, nav,
 * account/cart icons) never moves. */
export function DesktopSearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const state = useSearchState();
  const searchIcon = useIconPlay<HTMLSpanElement>();

  const close = () => { setOpen(false); state.setQuery(""); };

  useEffect(() => {
    if (open) {
      state.loadRecent();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={containerRef} className="hidden sm:block relative">
      <button
        onClick={() => setOpen(true)}
        onMouseEnter={() => !open && searchIcon.play({ rotate: [0, -12, 10, 0], scale: [1, 1.1, 1.1, 1] }, 0.45)}
        className={cn(
          "flex items-center gap-2 h-9 rounded-full border transition-colors",
          open ? "w-64 lg:w-80 px-3 border-border bg-white" : "w-9 justify-center border-transparent text-charcoal/60 hover:text-charcoal hover:bg-primary-light"
        )}
        aria-label="Search"
      >
        {/* Same imperative hover-play pattern as wishlist/cart/bell — a quick
            "scanning" tilt-and-settle rather than a generic scale/rotate,
            and always finishes back to rest instead of snapping mid-motion. */}
        <motion.span ref={searchIcon.scope} className="flex shrink-0">
          <Search className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2} />
        </motion.span>
        {open ? (
          <input
            ref={inputRef}
            value={state.query}
            onChange={(e) => state.setQuery(e.target.value)}
            onKeyDown={(e) => state.handleKeyDown(e, (slug) => { close(); router.push(`/products/${slug}`); })}
            placeholder="Search products…"
            className="flex-1 min-w-0 text-sm text-charcoal placeholder:text-charcoal-lighter outline-none bg-transparent"
            autoComplete="off"
          />
        ) : (
          <span className="sr-only">Search</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-[380px] max-h-[70vh] overflow-y-auto rounded-2xl border border-border/60 bg-white shadow-[0_16px_48px_rgba(58,36,56,0.14)] p-3"
          >
            <ResultsList state={state} onNavigate={() => { state.rememberSearch(state.query); close(); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Mobile: search icon takes over the whole header row while active. */
export function MobileSearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const state = useSearchState();
  const shouldReduceMotion = useReducedMotion();

  const close = () => { setOpen(false); state.setQuery(""); };

  useEffect(() => {
    if (open) {
      state.loadRecent();
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) {
    return (
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="sm:hidden flex items-center justify-center h-9 w-9 rounded-full text-charcoal/60 hover:text-charcoal hover:bg-primary-light transition-colors ml-1"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="sm:hidden fixed inset-0 z-50 bg-white flex flex-col"
    >
      <div className="flex items-center gap-2 h-[52px] px-4 border-b border-border/50 shrink-0">
        <Search className="h-4 w-4 text-charcoal-lighter shrink-0" />
        <input
          ref={inputRef}
          value={state.query}
          onChange={(e) => state.setQuery(e.target.value)}
          onKeyDown={(e) => state.handleKeyDown(e, (slug) => { close(); router.push(`/products/${slug}`); })}
          placeholder="Search products…"
          className="flex-1 min-w-0 text-base text-charcoal placeholder:text-charcoal-lighter outline-none bg-transparent"
          autoComplete="off"
        />
        <motion.button whileTap={{ scale: 0.88 }} onClick={close} className="p-1.5 rounded-full hover:bg-pearl text-charcoal-lighter shrink-0" aria-label="Close search">
          <X className="h-4 w-4" />
        </motion.button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <ResultsList state={state} onNavigate={() => { state.rememberSearch(state.query); close(); }} />
      </div>
    </motion.div>
  );
}
