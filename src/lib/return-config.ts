import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

// Admin-configurable return settings, stored under the `return_config` settings
// key (public-readable via GET /api/settings?key=return_config so the customer
// return form can load reasons + the eligibility window). Seeded from the
// original hardcoded reasons so nothing breaks before an admin edits anything.

export interface ReturnReason {
  code: string;
  label: string;
  enabled: boolean;
}

export interface ReturnConfig {
  reasons: ReturnReason[];
  /** Days after delivery a return may be requested. */
  windowDays: number;
}

export const DEFAULT_RETURN_REASONS: ReturnReason[] = [
  { code: "damaged", label: "Product damaged during delivery", enabled: true },
  { code: "wrong_item", label: "Received wrong item", enabled: true },
  { code: "not_as_described", label: "Product not as described", enabled: true },
  { code: "defective", label: "Product is defective", enabled: true },
  { code: "changed_mind", label: "Changed my mind", enabled: true },
  { code: "other", label: "Other reason", enabled: true },
];

export const DEFAULT_RETURN_CONFIG: ReturnConfig = {
  reasons: DEFAULT_RETURN_REASONS,
  windowDays: 7,
};

function coerce(raw: unknown): ReturnConfig {
  const obj = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
  const reasons = Array.isArray(obj.reasons)
    ? (obj.reasons as unknown[])
        .map((r) => {
          const o = (r && typeof r === "object") ? (r as Record<string, unknown>) : {};
          return {
            code: String(o.code || "").trim(),
            label: String(o.label || "").trim(),
            enabled: o.enabled !== false,
          };
        })
        .filter((r) => r.code && r.label)
    : DEFAULT_RETURN_REASONS;
  const windowDays = Number(obj.windowDays);
  return {
    reasons: reasons.length ? reasons : DEFAULT_RETURN_REASONS,
    windowDays: Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : 7,
  };
}

/** Server-side read of the return config, falling back to defaults. */
export async function getReturnConfig(): Promise<ReturnConfig> {
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'return_config' LIMIT 1");
    if (!rows.length) return DEFAULT_RETURN_CONFIG;
    const raw = typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
    return coerce(raw);
  } catch {
    return DEFAULT_RETURN_CONFIG;
  }
}

/** Resolve a reason code → its label (from config, else humanized fallback). */
export function reasonLabel(config: ReturnConfig, code: string): string {
  const found = config.reasons.find((r) => r.code === code);
  if (found) return found.label;
  return code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
