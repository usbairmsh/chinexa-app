"use client";

import { useState, useEffect } from "react";
import { SYSTEM_TAG_FALLBACK, type Tag } from "@/lib/tags";

// Tag definitions are needed by every product card, so they are fetched once
// per page load and shared from a module-level cache — the same shape
// use-store-settings.ts uses. `fetchPromise` dedups the concurrent calls that
// would otherwise fire from a grid of cards all mounting at once.

let cachedTags: Tag[] | null = null;
let fetchPromise: Promise<Tag[]> | null = null;

async function loadTags(): Promise<Tag[]> {
  if (cachedTags) return cachedTags;
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch("/api/tags?active=true")
    .then((r) => r.json())
    .then((data) => {
      const list: Tag[] = Array.isArray(data) ? data : [];
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
  fetchPromise = null;
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>(cachedTags || SYSTEM_TAG_FALLBACK);
  const [loaded, setLoaded] = useState(!!cachedTags);

  useEffect(() => {
    loadTags().then((t) => { setTags(t); setLoaded(true); });
  }, []);

  return { tags, loaded };
}
