"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { COUNTRIES, getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CountrySearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function CountrySearch({ value, onChange }: CountrySearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.code.toLowerCase().includes(query.toLowerCase())
      )
    : COUNTRIES;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (name: string) => {
    onChange(name);
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
      <label className="block text-sm font-medium text-charcoal-light mb-1.5">Country of Origin</label>
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
          {value ? <>{getCountryFlag(value)} {value}</> : "Select country..."}
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
                placeholder="Search country..."
                className="w-full py-2 text-sm bg-transparent outline-none text-charcoal placeholder:text-charcoal-lighter/50"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-charcoal-lighter text-center">No countries found</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleSelect(c.name)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors",
                    value === c.name ? "bg-secondary/10 text-secondary font-medium" : "text-charcoal hover:bg-pearl"
                  )}
                >
                  <span className="text-base">{c.flag}</span>
                  <span>{c.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
