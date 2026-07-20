import { cache } from "react";
import type { Metadata } from "next";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// ─────────────────────────────────────────────────────────────────────────────
// Page-level SEO overrides (admin → SEO Management → Page Meta)
//
// The seo_metadata table has existed for a while, but only the `_global` row
// was ever read (root layout title/description). Everything below makes the
// per-page rows actually take effect: any layout can merge an admin-entered
// override on top of its own computed defaults via pageMetadata().
// ─────────────────────────────────────────────────────────────────────────────

export interface SeoOverride {
  title: string | null;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string[];
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  no_index: boolean;
  no_follow: boolean;
}

function parseKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((k): k is string => typeof k === "string");
  if (typeof raw === "string" && raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
    } catch { return []; }
  }
  return [];
}

// cache() dedupes within a request — generateMetadata and the layout body can
// both call this for the same path with one DB round trip.
export const getSeoOverride = cache(async (path: string): Promise<SeoOverride | null> => {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT * FROM seo_metadata WHERE page_path = ? LIMIT 1",
      [path]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      title: (r.title as string) || null,
      meta_title: (r.meta_title as string) || null,
      meta_description: (r.meta_description as string) || null,
      keywords: parseKeywords(r.keywords),
      canonical_url: (r.canonical_url as string) || null,
      og_title: (r.og_title as string) || null,
      og_description: (r.og_description as string) || null,
      og_image: (r.og_image as string) || null,
      no_index: !!r.no_index,
      no_follow: !!r.no_follow,
    };
  } catch {
    // A DB hiccup must never take down page rendering — no override applies.
    return null;
  }
});

function absoluteUrl(url: string): string {
  return url.startsWith("http") ? url : `${siteUrl}${url}`;
}

/**
 * Merge an admin-entered page override on top of a page's default metadata.
 * Fields the admin left blank fall through to the defaults, so a page's own
 * computed SEO keeps working until something is deliberately overridden.
 */
export async function pageMetadata(path: string, defaults: Metadata = {}): Promise<Metadata> {
  const o = await getSeoOverride(path);
  if (!o) return defaults;

  const title = o.meta_title || o.title || undefined;
  const description = o.meta_description || undefined;
  const ogImage = o.og_image ? [{ url: absoluteUrl(o.og_image) }] : undefined;

  const merged: Metadata = {
    ...defaults,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(o.keywords.length ? { keywords: o.keywords } : {}),
  };

  if (o.canonical_url) {
    merged.alternates = { ...defaults.alternates, canonical: o.canonical_url };
  }

  if (title || description || ogImage) {
    merged.openGraph = {
      ...defaults.openGraph,
      ...(o.og_title || title ? { title: o.og_title || title } : {}),
      ...(o.og_description || description ? { description: o.og_description || description } : {}),
      ...(ogImage ? { images: ogImage } : {}),
    };
  }

  if (o.no_index || o.no_follow) {
    merged.robots = { index: !o.no_index, follow: !o.no_follow };
  }

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracking / verification config (admin → SEO Management → Tracking)
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackingConfig {
  ga_id?: string;
  search_console?: string;
  meta_pixel?: string;
  tiktok_pixel?: string;
  bing_verify?: string;
  pinterest_verify?: string;
}

export const getTrackingConfig = cache(async (): Promise<TrackingConfig> => {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT value FROM settings WHERE `key` = 'tracking_config' LIMIT 1"
    );
    if (rows.length === 0) return {};
    const cfg = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
    return cfg && typeof cfg === "object" ? (cfg as TrackingConfig) : {};
  } catch {
    return {};
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Structured-data toggles (admin → SEO Management → Schema)
// ─────────────────────────────────────────────────────────────────────────────

export interface SchemaConfig {
  organization: boolean;
  website: boolean;
  product: boolean;
  breadcrumb: boolean;
  brand: boolean;
  review: boolean;
}

export const DEFAULT_SCHEMA_CONFIG: SchemaConfig = {
  organization: true,
  website: true,
  product: true,
  breadcrumb: true,
  brand: true,
  review: true,
};

export const getSchemaConfig = cache(async (): Promise<SchemaConfig> => {
  try {
    const rows = await query<RowDataPacket[]>(
      "SELECT value FROM settings WHERE `key` = 'schema_config' LIMIT 1"
    );
    if (rows.length === 0) return DEFAULT_SCHEMA_CONFIG;
    const cfg = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
    return { ...DEFAULT_SCHEMA_CONFIG, ...(cfg && typeof cfg === "object" ? cfg : {}) };
  } catch {
    return DEFAULT_SCHEMA_CONFIG;
  }
});
