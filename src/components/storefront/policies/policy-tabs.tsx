"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PolicyPage } from "@/types/policy";

/**
 * Responsive tabbed view of every policy. Data-driven: it renders one tab per
 * policy passed in, so when an admin adds a new policy (a new entry in the
 * policy_pages setting) a new tab appears automatically — no code change.
 *
 * - Desktop/tablet: a vertical sidebar of tabs beside the content.
 * - Mobile: a horizontal, scrollable tab strip above the content.
 */
export function PolicyTabs({ policies, initialSlug }: { policies: PolicyPage[]; initialSlug?: string }) {
  const [active, setActive] = useState(() => {
    const found = initialSlug && policies.find((p) => p.slug === initialSlug);
    return found ? initialSlug! : policies[0]?.slug || "";
  });

  const current = policies.find((p) => p.slug === active) || policies[0];
  if (!current) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Mobile/tablet: horizontal scrollable tab strip */}
      <div className="lg:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {policies.map((p) => (
            <button
              key={p.slug}
              onClick={() => setActive(p.slug)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-[0.97]",
                active === p.slug
                  ? "bg-secondary text-white shadow-sm"
                  : "bg-pearl text-charcoal-lighter hover:text-charcoal"
              )}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop/tablet: vertical sidebar */}
      <nav className="hidden lg:block w-60 shrink-0">
        <div className="sticky top-24 space-y-1">
          {policies.map((p) => (
            <button
              key={p.slug}
              onClick={() => setActive(p.slug)}
              className={cn(
                "flex w-full items-center rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all active:scale-[0.99]",
                active === p.slug
                  ? "bg-secondary/10 text-secondary ring-1 ring-secondary/20"
                  : "text-charcoal-lighter hover:bg-pearl hover:text-charcoal"
              )}
            >
              {p.title}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-border/60 shadow-card p-5 sm:p-8 lg:p-10">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-2">{current.title}</h2>
          {current.intro && <p className="text-sm sm:text-base text-charcoal-lighter mb-8">{current.intro}</p>}

          <div className="space-y-7">
            {current.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="font-heading text-lg font-semibold text-charcoal mb-3">{section.heading}</h3>
                <ul className="space-y-2">
                  {section.body.map((line, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-charcoal-light">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="text-xs text-charcoal-lighter mt-10 pt-6 border-t border-border/30">
            Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}. Questions about this policy? Contact us.
          </p>
        </div>
      </div>
    </div>
  );
}
