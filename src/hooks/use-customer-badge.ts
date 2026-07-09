"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";

interface BadgeData {
  // "" whenever the tier's badge is turned off — every consumer already
  // gates rendering on `badge_color` truthiness, so folding badge_enabled in
  // here hides the badge everywhere with no per-call-site changes needed.
  badge_name: string;
  badge_color: string;
  badge_opacity: number;
  tier_name: string;
  tier_color: string;
}

const badgeCache = new Map<string, BadgeData>();

/** Bust the cached badge for a customer — call after any tier/badge edit so open tabs don't show stale state. */
export function invalidateCustomerBadge(customerId: string) {
  badgeCache.delete(customerId);
}

export function useCustomerBadge() {
  const user = useAuthStore((s) => s.user);
  const [badge, setBadge] = useState<BadgeData | null>(null);

  useEffect(() => {
    if (!user?.id) { setBadge(null); return; }

    // Check cache first
    const cached = badgeCache.get(user.id);
    if (cached) { setBadge(cached); return; }

    fetch(`/api/customers/${user.id}/points`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.tier?.name) {
          const enabled = !!data.tier.badge_enabled;
          const b: BadgeData = {
            badge_name: enabled ? data.tier.badge_name || "" : "",
            badge_color: enabled ? data.tier.badge_color || "" : "",
            badge_opacity: data.tier.badge_opacity ?? 1,
            tier_name: data.tier.name || "",
            tier_color: data.tier.color || "",
          };
          badgeCache.set(user.id, b);
          setBadge(b);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  return badge;
}
