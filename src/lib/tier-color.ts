/**
 * Membership tier `color` is dual-format for historical reasons: either a raw
 * hex string (new tiers, picked via the admin color picker) or a legacy
 * Tailwind class string like "bg-blue-100 text-blue-700" (tiers created
 * before the hex picker existed). Every place that renders a tier-colored
 * container needs to handle both — this is the single shared implementation
 * so admin and customer surfaces render tiers identically.
 */
export interface TierColorStyle {
  /** Inline style to spread onto the container when `color` is a hex value — undefined for legacy Tailwind-class tiers, where `className` should be used instead. */
  style?: { backgroundColor: string; color: string };
  /** Tailwind class to apply when `color` is a legacy class string — undefined for hex tiers. */
  className?: string;
}

export function resolveTierColorStyle(color: string | undefined | null): TierColorStyle {
  if (!color) return { className: "bg-pearl text-charcoal-lighter" };
  if (color.startsWith("#")) {
    return { style: { backgroundColor: `${color}18`, color } };
  }
  return { className: color };
}

/** Guest pseudo-tier shown wherever registered-tier and guest conversations/customers are listed side by side. */
export const GUEST_TIER_COLOR_CLASS = "bg-charcoal/10 text-charcoal-lighter";
