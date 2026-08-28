"use client";

import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/use-tags";
import { autoTextColor, cardSlugs, sortSlugsByPriority, type Tag } from "@/lib/tags";

// Renders a product tag in its admin-configured colours. Kept separate from
// <Badge>, which still owns the non-product variants (success, warning, …) —
// those are design-token states, not merchant-editable labels.

export function TagChip({ tag, className }: { tag: Tag; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
        className
      )}
      // Inline styles rather than classes: the colour is arbitrary admin data,
      // so it cannot be a compiled Tailwind class. Solid background on purpose —
      // these sit on product photography, where an alpha tint washes out.
      style={{ backgroundColor: tag.color, color: tag.text_color || autoTextColor(tag.color) }}
    >
      {tag.label}
    </span>
  );
}

/**
 * Render a product's tags from its slugs, ordered by the admin's priority.
 *
 * `limit` caps how many render — product cards pass MAX_CARD_TAGS via
 * `variant="card"`, while the product detail page passes nothing and shows all,
 * matching how the hide-on-card toggle already behaves.
 *
 * Slugs with no matching tag are skipped: a tag deleted mid-render, or one
 * that's been deactivated, should disappear rather than draw an unstyled chip.
 */
export function TagChips({
  slugs,
  variant = "all",
  className,
  chipClassName,
}: {
  slugs: string[];
  variant?: "all" | "card";
  className?: string;
  chipClassName?: string;
}) {
  const { tags } = useTags();
  if (!slugs || slugs.length === 0) return null;

  const bySlug = new Map(tags.map((t) => [t.slug, t]));
  const ordered = variant === "card" ? cardSlugs(slugs, tags) : sortSlugsByPriority(slugs, tags);
  const visible = ordered.map((s) => bySlug.get(s)).filter((t): t is Tag => !!t);
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {visible.map((tag) => (
        <TagChip key={tag.slug} tag={tag} className={chipClassName} />
      ))}
    </div>
  );
}
