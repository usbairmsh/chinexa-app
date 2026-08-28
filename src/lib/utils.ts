import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks a list of { label, value } pairs and returns a single message
 * listing every empty one, e.g. "Please fill in: Name, Price, Image" —
 * or null if all are present. `value` counts as empty when it's a blank/
 * whitespace-only string, false/0-as-"unset" is NOT treated as empty (only
 * strings are trim-checked; pass a boolean expression directly for
 * non-string requirements like "at least one image uploaded").
 */
export function collectMissingFields(fields: { label: string; value: unknown }[]): string | null {
  const missing = fields
    .filter(({ value }) => (typeof value === "string" ? !value.trim() : !value))
    .map(({ label }) => label);
  if (missing.length === 0) return null;
  return `Please fill in: ${missing.join(", ")}`;
}

export function formatCurrency(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatPhone(phone: string): string {
  if (phone.startsWith("+880")) {
    const num = phone.slice(4);
    return `+880 ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  return phone;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeWebsite(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + "...";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function randomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Coerce user-typed colour input into a canonical #RRGGBB, or null if it isn't
 * a colour at all.
 *
 * Accepts what people actually type rather than only the strict form: a missing
 * "#", lowercase, surrounding spaces, and 3-digit shorthand (#f00 → #FF0000).
 * Returning null for anything else lets a caller show an error instead of
 * silently storing a value that renders as black.
 */
export function normalizeHex(input: string | null | undefined): string | null {
  const raw = String(input ?? "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split("").map((c) => c + c).join("").toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}
