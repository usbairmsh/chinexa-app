import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { ensureTagTables } from "@/lib/migrate-tags";

// ─── Tag domain logic ─────────────────────────────────────────────────────────
// Pure helpers live at the top and take plain arguments (no DB, no request), so
// the rules below are the single definition of tag behaviour shared by the API,
// the admin UI, the storefront and the expiry sweep. Anything that needs to
// decide "is this tag still valid" or "which three show on the card" must come
// through here rather than re-deriving it.

export type TagAttachType = "none" | "category" | "subcategory" | "product" | "offer" | "coupon";
export type TagValidityMode = "none" | "date" | "days" | "months" | "years";

/** Attachment targets that are DISPLAY-ONLY: the chip renders on the record,
 *  but the tag never changes which products an offer covers or what a customer
 *  is charged. Kept explicit so pricing can never be affected by a tag edit. */
export const DISPLAY_ONLY_ATTACH: TagAttachType[] = ["offer", "coupon"];

/** How many tags a product CARD can show. The product detail page deliberately
 *  shows all of them — same split the hide-on-card eye toggle already uses. */
export const MAX_CARD_TAGS = 3;

export interface Tag {
  id: string;
  slug: string;
  label: string;
  color: string;
  text_color: string | null;
  is_system: boolean;
  attach_type: TagAttachType;
  attach_ids: string[];
  validity_mode: TagValidityMode;
  validity_value: string | null;
  is_active: boolean;
  priority: number;
}

// ─── Slugs ────────────────────────────────────────────────────────────────────

/** Slugs go into products.badges and into LIKE patterns, so they are restricted
 *  to lowercase/digits/hyphen — no quotes or % that could disturb a match. */
export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 60;
}

// ─── Colour ───────────────────────────────────────────────────────────────────

export function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(String(hex || ""));
}

/**
 * Pick black or white for the label, whichever contrasts better with the tag's
 * background. Uses the WCAG relative-luminance formula rather than a naive
 * average, because the eye is far more sensitive to green than to blue — a
 * plain average turns pure blue into "light" and prints black on it.
 *
 * Only used when an admin has not set text_color explicitly.
 */
export function autoTextColor(bgHex: string): string {
  if (!isValidHex(bgHex)) return "#FFFFFF";
  const srgb = [1, 3, 5].map((i) => parseInt(bgHex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // 0.179 is the luminance where black and white contrast equally (√1.05·0.05 − 0.05).
  return luminance > 0.179 ? "#111111" : "#FFFFFF";
}

/** Contrast ratio between two hex colours, per WCAG 2.x. Used to warn an admin
 *  that a chosen colour will be hard to read — it warns, it does not block. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const srgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  if (!isValidHex(a) || !isValidHex(b)) return 21;
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ─── The attach / validity invariant ──────────────────────────────────────────

/**
 * An ATTACHED tag has no validity — it lives as long as the thing it is
 * attached to. Only a free-floating tag can expire. Enforced here so the API
 * and the UI cannot disagree about it.
 *
 * Returns a human-readable error, or null when the combination is legal.
 */
export function validateAttachAndValidity(
  attachType: TagAttachType,
  attachIds: string[],
  validityMode: TagValidityMode,
  validityValue: string | null
): string | null {
  if (attachType !== "none") {
    if (attachIds.length === 0) {
      return "Pick at least one item to attach this tag to, or set it to Not attached.";
    }
    if (validityMode !== "none") {
      return "An attached tag can't also have a validity period — it lasts as long as what it's attached to.";
    }
    return null;
  }

  // Unattached: validity is optional, but if set it must be usable.
  if (validityMode === "none") return null;
  const raw = String(validityValue ?? "").trim();
  if (!raw) return "Enter how long this tag stays valid.";

  if (validityMode === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "Enter the expiry date as YYYY-MM-DD.";
    const parsed = new Date(`${raw}T23:59:59Z`);
    if (Number.isNaN(parsed.getTime())) return "That expiry date isn't a real date.";
    return null;
  }

  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return "The validity period must be a whole number greater than zero.";
  if (n > 3650) return "That validity period is unreasonably long — use 3650 or fewer.";
  return null;
}

// ─── Expiry ───────────────────────────────────────────────────────────────────

/**
 * When a tag applied at `appliedAt` expires. null = never (either the tag has
 * no validity, or it is attached, or we have no application timestamp — an
 * unknown application date must never be treated as already-expired, or a
 * product predating this feature would lose its tags on the first sweep).
 *
 * Month/year arithmetic uses setUTCMonth/setUTCFullYear rather than adding a
 * fixed number of days, so "1 month" from the 31st lands correctly and leap
 * years are handled by the platform.
 */
export function expiryFor(tag: Pick<Tag, "attach_type" | "validity_mode" | "validity_value">, appliedAt: string | Date | null): Date | null {
  if (tag.attach_type !== "none") return null;
  if (tag.validity_mode === "none") return null;

  if (tag.validity_mode === "date") {
    const raw = String(tag.validity_value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const d = new Date(`${raw}T23:59:59Z`); // inclusive: valid through the whole day
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (!appliedAt) return null;
  const start = new Date(appliedAt);
  if (Number.isNaN(start.getTime())) return null;
  const n = Number(tag.validity_value);
  if (!Number.isInteger(n) || n <= 0) return null;

  const end = new Date(start.getTime());
  if (tag.validity_mode === "days") {
    end.setUTCDate(end.getUTCDate() + n);
  } else {
    // Month/year steps are clamped to the last day of the target month rather
    // than left to overflow. Raw setUTCMonth turns "1 month from Jan 31" into
    // Mar 3 (Feb 31 rolls forward), which is not what an admin means. Clamping
    // gives Feb 28 — the intuitive answer, and the one every date library uses.
    const day = end.getUTCDate();
    end.setUTCDate(1);
    if (tag.validity_mode === "months") end.setUTCMonth(end.getUTCMonth() + n);
    else end.setUTCFullYear(end.getUTCFullYear() + n);
    const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
    end.setUTCDate(Math.min(day, lastDay));
  }
  return end;
}

export function isExpired(
  tag: Pick<Tag, "attach_type" | "validity_mode" | "validity_value">,
  appliedAt: string | Date | null,
  now: Date = new Date()
): boolean {
  const end = expiryFor(tag, appliedAt);
  return end !== null && now.getTime() >= end.getTime();
}

// ─── Ordering + the card cap ──────────────────────────────────────────────────

/**
 * Order a product's slugs by tag priority (lower first), so the three that show
 * on a card are the three the admin ranked highest.
 *
 * Unknown slugs — a tag deleted from the table but still sitting in some
 * product's badges — sort last rather than being dropped, so a stale slug can
 * never silently displace a real tag. Ties break on slug for a stable order.
 */
export function sortSlugsByPriority(slugs: string[], tags: Pick<Tag, "slug" | "priority">[]): string[] {
  const rank = new Map(tags.map((t) => [t.slug, t.priority]));
  return [...slugs].sort((a, b) => {
    const pa = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const pb = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    return pa === pb ? a.localeCompare(b) : pa - pb;
  });
}

/** The slugs a product CARD shows: highest priority first, capped. */
export function cardSlugs(slugs: string[], tags: Pick<Tag, "slug" | "priority">[]): string[] {
  return sortSlugsByPriority(slugs, tags).slice(0, MAX_CARD_TAGS);
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** Normalise a JSON column that mysql2 may hand back already-parsed. */
export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowToTag(r: RowDataPacket): Tag {
  return {
    id: String(r.id),
    slug: String(r.slug),
    label: String(r.label),
    color: String(r.color),
    text_color: r.text_color ? String(r.text_color) : null,
    is_system: Boolean(r.is_system),
    attach_type: String(r.attach_type) as TagAttachType,
    attach_ids: parseJsonArray(r.attach_ids),
    validity_mode: String(r.validity_mode) as TagValidityMode,
    validity_value: r.validity_value ? String(r.validity_value) : null,
    is_active: Boolean(r.is_active),
    priority: Number(r.priority) || 0,
  };
}

/** Every tag, highest priority first. */
export async function getTags(opts: { activeOnly?: boolean } = {}): Promise<Tag[]> {
  await ensureTagTables();
  const rows = await query<RowDataPacket[]>(
    `SELECT * FROM tags ${opts.activeOnly ? "WHERE is_active = TRUE" : ""} ORDER BY priority ASC, label ASC`
  );
  return rows.map(rowToTag);
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  await ensureTagTables();
  const rows = await query<RowDataPacket[]>("SELECT * FROM tags WHERE slug = ? LIMIT 1", [slug]);
  return rows.length ? rowToTag(rows[0]) : null;
}

// ─── Request-body parsing ───────────────────────────────────────────────
// Shared by POST /api/tags and PATCH /api/tags/[id] so a tag created one way
// can never be validated differently from one edited the other way.

const ATTACH_TYPES: TagAttachType[] = ["none", "category", "subcategory", "product", "offer", "coupon"];
const VALIDITY_MODES: TagValidityMode[] = ["none", "date", "days", "months", "years"];

/**
 * Shared field parsing + validation for POST and PATCH.
 * Returns either an error message or a clean, storable set of values.
 */
export function parseTagBody(body: Record<string, unknown>): { error: string } | {
  label: string; color: string; textColor: string | null;
  attachType: TagAttachType; attachIds: string[];
  validityMode: TagValidityMode; validityValue: string | null;
  isActive: boolean; priority: number;
} {
  const label = String(body.label ?? "").trim();
  if (label.length < 2) return { error: "Tag name must be at least 2 characters." };
  if (label.length > 80) return { error: "Tag name must be 80 characters or fewer." };

  const color = String(body.color ?? "").trim();
  if (!isValidHex(color)) return { error: "Pick a colour for the tag." };

  const rawText = body.text_color == null ? "" : String(body.text_color).trim();
  if (rawText && !isValidHex(rawText)) return { error: "Text colour must be a hex value like #FFFFFF." };
  const textColor = rawText || null;

  const attachType = String(body.attach_type ?? "none") as TagAttachType;
  if (!ATTACH_TYPES.includes(attachType)) return { error: "Unknown attachment type." };

  const attachIds = Array.isArray(body.attach_ids)
    ? [...new Set(body.attach_ids.map((v) => String(v).trim()).filter(Boolean))]
    : [];

  const validityMode = String(body.validity_mode ?? "none") as TagValidityMode;
  if (!VALIDITY_MODES.includes(validityMode)) return { error: "Unknown validity type." };

  const validityValue = body.validity_value == null ? null : String(body.validity_value).trim() || null;

  // The attach/validity invariant lives in lib/tags.ts so this route and the
  // admin UI can never disagree about it.
  const invariant = validateAttachAndValidity(attachType, attachIds, validityMode, validityValue);
  if (invariant) return { error: invariant };

  const priorityRaw = Number(body.priority);
  const priority = Number.isFinite(priorityRaw) ? Math.max(0, Math.min(9999, Math.round(priorityRaw))) : 100;

  return {
    label, color, textColor, attachType, attachIds,
    // Normalised so an attached tag can never carry stale validity data, and an
    // unattached one can never carry stale attachment ids.
    validityMode: attachType === "none" ? validityMode : "none",
    validityValue: attachType === "none" ? validityValue : null,
    isActive: body.is_active === undefined ? true : Boolean(body.is_active),
    priority,
  };
}

