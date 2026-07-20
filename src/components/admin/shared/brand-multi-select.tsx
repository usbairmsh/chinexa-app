"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown, Award, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandMultiSelectProps {
  brands: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function BrandMultiSelect({ brands, selected, onToggle }: BrandMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? brands.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
    : brands;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-charcoal-light mb-1.5">Associated Brands</label>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selected.map((id) => {
            const b = brands.find((br) => br.id === id);
            return b ? (
              <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-medium">
                {b.name}
                <button type="button" onClick={() => onToggle(id)} className="hover:text-destructive transition-colors">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={cn(
          "flex items-center justify-between w-full h-11 px-3 rounded-luxury text-sm transition-all",
          open ? "bg-white shadow-[inset_0_0_0_1.5px_var(--color-secondary)]" : "bg-beige-dark/70 shadow-[inset_0_0_0_1px_rgba(58,36,56,0.06)] hover:bg-beige-dark",
          selected.length > 0 ? "text-charcoal" : "text-charcoal-lighter"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <Award className="h-3.5 w-3.5 text-charcoal-lighter" />
          {selected.length > 0 ? `${selected.length} brand${selected.length > 1 ? "s" : ""} selected` : "Search and select brands..."}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-charcoal-lighter transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-luxury border border-border/50 bg-white shadow-luxury-hover overflow-hidden animate-scale-in">
          <div className="p-2 border-b border-border/30">
            <div className="flex items-center gap-2 px-2 rounded-lg bg-pearl/60">
              <Search className="h-3.5 w-3.5 text-charcoal-lighter shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search brands..."
                className="w-full py-2 text-sm bg-transparent outline-none text-charcoal placeholder:text-charcoal-lighter/50"
                autoFocus
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-charcoal-lighter hover:text-charcoal">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-charcoal-lighter text-center">No brands found</p>
            ) : (
              filtered.map((b) => {
                const isSelected = selected.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onToggle(b.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors",
                      isSelected ? "bg-secondary/5 text-secondary font-medium" : "text-charcoal hover:bg-pearl"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Award className="h-3.5 w-3.5 text-charcoal-lighter" />
                      {b.name}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-secondary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
