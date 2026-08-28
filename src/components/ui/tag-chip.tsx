"use client";

import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/use-tags";
import { autoTextColor, cardSlugs, sortSlugsByPriority, orphanTag, type Tag } from "@/lib/tags";

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
  const { tags, allSlugs } = useTags();
  if (!slugs || slugs.length === 0) return null;

  const bySlug = new Map(tags.map((t) => [t.slug, t]));
  const ordered = variant === "card" ? cardSlugs(slugs, tags) : sortSlugsByPriority(slugs, tags);

  // Two different reasons a slug has no tag here, and they must behave
  // differently. The hook only fetches ACTIVE tags, so a slug can be missing
  // because an admin deactivated it — deliberate, and it should stay hidden.
  // But an unknown slug (no row at all) is a label already live on the
  // storefront, and dropping it would look like data loss. The migration adopts
  // those on boot; this renders them with a derived label meanwhile.
  const knownSlugs = new Set(allSlugs);
  const visible: Tag[] = ordered
    .filter((slug) => bySlug.has(slug) || !knownSlugs.has(slug))
    .map((slug) => bySlug.get(slug) ?? orphanTag(slug));
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {visible.map((tag) => (
        <TagChip key={tag.slug} tag={tag} className={chipClassName} />
      ))}
    </div>
  );
}

/**
 * Tags an admin has attached to a specific offer or coupon.
 *
 * Display only, by design: the chip labels the record, it never changes which
 * products the offer covers or what a customer is charged. Keeping attachment
 * inert means editing a tag can't move prices.
 */
export function AttachedTagChips({
  attachType,
  targetId,
  className,
}: {
  attachType: "offer" | "coupon" | "category" | "subcategory" | "product";
  targetId: string;
  className?: string;
}) {
  const { tags } = useTags();
  const attached = tags.filter((t) => t.attach_type === attachType && t.attach_ids.includes(targetId));
  if (attached.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {attached.map((tag) => (
        <TagChip key={tag.slug} tag={tag} className="px-2 py-0.5 text-[9px]" />
      ))}
    </div>
  );
}
