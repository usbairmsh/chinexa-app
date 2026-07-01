"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandSearchProps {
  brands: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function BrandSearch({ brands, value, onChange }: BrandSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedName = brands.find((b) => b.id === value)?.name || "";

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

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-charcoal-light mb-1.5">Brand</label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={cn(
          "flex items-center justify-between w-full h-11 px-3 rounded-xl border text-sm transition-all",
          open ? "border-secondary ring-2 ring-secondary/20" : "border-border",
          value ? "text-charcoal" : "text-charcoal-lighter"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedName ? <><Award className="h-3.5 w-3.5 text-secondary" /> {selectedName}</> : "Select brand (optional)"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={(e) => { e.stopPropagation(); handleClear(); }} className="p-0.5 hover:bg-pearl rounded-full text-charcoal-lighter hover:text-charcoal transition-colors">
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-charcoal-lighter transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border/30">
            <div className="flex items-center gap-2 px-2 rounded-lg bg-pearl/60">
              <Search className="h-3.5 w-3.5 text-charcoal-lighter shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search brand..."
                className="w-full py-2 text-sm bg-transparent outline-none text-charcoal placeholder:text-charcoal-lighter/50"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={cn("flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors", !value ? "bg-secondary/10 text-secondary font-medium" : "text-charcoal-lighter hover:bg-pearl")}
            >
              No Brand
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-charcoal-lighter text-center">No brands found</p>
            ) : (
              filtered.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelect(b.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors",
                    value === b.id ? "bg-secondary/10 text-secondary font-medium" : "text-charcoal hover:bg-pearl"
                  )}
                >
                  <Award className="h-3.5 w-3.5 text-charcoal-lighter" />
                  {b.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
