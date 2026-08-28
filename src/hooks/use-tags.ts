"use client";

import { useState, useEffect } from "react";
import { SYSTEM_TAG_FALLBACK, type Tag } from "@/lib/tags";

// Tag definitions are needed by every product card, so they are fetched once
// per page load and shared from a module-level cache — the same shape
// use-store-settings.ts uses. `fetchPromise` dedups the concurrent calls that
// would otherwise fire from a grid of cards all mounting at once.

let cachedTags: Tag[] | null = null;
let fetchPromise: Promise<Tag[]> | null = null;
// Slugs of ALL tags, active or not. Lets a renderer distinguish a tag an admin
// deliberately deactivated (stay hidden) from a slug with no row at all (render
// it — it is already live on the storefront).
let cachedAllSlugs: string[] = [];

async function loadTags(): Promise<Tag[]> {
  if (cachedTags) return cachedTags;
  if (fetchPromise) return fetchPromise;

  // Fetches every tag, not just active ones: the inactive slugs are needed to
  // tell "deliberately hidden" from "no row yet". Active-only filtering happens
  // below, so callers still receive just the renderable tags.
  fetchPromise = fetch("/api/tags")
    .then((r) => r.json())
    .then((data) => {
      const all: Tag[] = Array.isArray(data) ? data : [];
      cachedAllSlugs = all.map((t) => t.slug);
      const list = all.filter((t) => t.is_active);
      cachedTags = list;
      return list;
    })
    // On failure fall back to the built-ins rather than rendering unstyled
    // chips — a network blip should not strip every product of its labels.
    .catch(() => SYSTEM_TAG_FALLBACK);

  return fetchPromise;
}

/** Clear the cache so the next read refetches (used after an admin edit). */
export function invalidateTags() {
  cachedTags = null;
  cachedAllSlugs = [];
  fetchPromise = null;
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>(cachedTags || SYSTEM_TAG_FALLBACK);
  const [allSlugs, setAllSlugs] = useState<string[]>(cachedAllSlugs);
  const [loaded, setLoaded] = useState(!!cachedTags);

  useEffect(() => {
    loadTags().then((t) => { setTags(t); setAllSlugs(cachedAllSlugs); setLoaded(true); });
  }, []);

  return { tags, allSlugs, loaded };
}
