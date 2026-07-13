import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { logActivity } from "@/lib/log-activity";
import { validationError, publicServerError } from "@/lib/validate";
import { requirePermission } from "@/lib/admin-permissions-server";

// Maps a settings `key` to the permission section (and required action) that
// gates writing it. Every key written via PUT is an admin-only screen (see
// call sites in src/app/admin/**) — none of these are written from the
// storefront, so it's safe to require an admin permission for all of them.
// Keys not listed here fall back to the generic System > Settings permission
// rather than being left completely unguarded.
const SETTINGS_KEY_PERMISSIONS: Record<string, { section: string; action: "edit" }> = {
  policy_pages: { section: "policies", action: "edit" },
  homepage_config: { section: "homepage", action: "edit" },
  announcements: { section: "announcements", action: "edit" },
  tracking_config: { section: "seo", action: "edit" },
  // NOTE: trust_badges_config is intentionally NOT listed here. It has no
  // sidebar entry and no dedicated PERMISSION_SECTIONS key today (it's only
  // reachable via a direct link from the product edit/new pages) — it falls
  // through to the "settings" default below. Flagged for human review: it
  // may deserve its own section, or to be folded into "homepage" instead.
};

function permissionForKey(key: string): { section: string; action: "edit" } {
  return SETTINGS_KEY_PERMISSIONS[key] ?? { section: "settings", action: "edit" };
}

export const dynamic = "force-dynamic";

// GET /api/settings?key=homepage_config (single) or ?keys=k1,k2 (multiple) or no param (all)
export async function GET(req: NextRequest) {
  try {
    const key = new URL(req.url).searchParams.get("key");
    const keys = new URL(req.url).searchParams.get("keys");

    if (key) {
      const rows = await query<RowDataPacket[]>("SELECT `key`, value FROM settings WHERE `key` = ?", [key]);
      if (rows.length === 0) return NextResponse.json(null);
      try { return NextResponse.json({ key: rows[0].key, value: JSON.parse(rows[0].value as string) }); }
      catch { return NextResponse.json({ key: rows[0].key, value: rows[0].value }); }
    }

    if (keys) {
      const keyList = keys.split(",").map((k) => k.trim()).filter(Boolean);
      if (keyList.length === 0) return NextResponse.json({});
      const placeholders = keyList.map(() => "?").join(",");
      const rows = await query<RowDataPacket[]>(`SELECT \`key\`, value FROM settings WHERE \`key\` IN (${placeholders})`, keyList);
      const result: Record<string, unknown> = {};
      for (const row of rows) {
        try { result[row.key as string] = JSON.parse(row.value as string); }
        catch { result[row.key as string] = row.value; }
      }
      return NextResponse.json(result);
    }

    // Return all
    const rows = await query<RowDataPacket[]>("SELECT `key`, value FROM settings");
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try { result[row.key as string] = JSON.parse(row.value as string); }
      catch { result[row.key as string] = row.value; }
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    return publicServerError("GET /api/settings", error);
  }
}

// PUT /api/settings — Upsert one or more keys: { key: "x", value: {...} } or { settings: { key1: val1, key2: val2 } }
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.key && !body.settings) {
      return validationError("No settings provided to update");
    }

    // Single key update
    if (body.key) {
      const { section, action } = permissionForKey(body.key);
      const denied = await requirePermission(req, section, action);
      if (denied) return denied;

      const val = JSON.stringify(body.value ?? null); // JSON.stringify(undefined) would break the INSERT
      await execute("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()", [body.key, val, val]);
      await logActivity("Updated settings", "settings", body.key);
      return NextResponse.json({ success: true });
    }

    // Bulk update
    if (body.settings && typeof body.settings === "object") {
      const keys = Object.keys(body.settings);
      const sections = new Map(keys.map((k) => [permissionForKey(k).section, permissionForKey(k).action]));
      for (const [section, action] of sections) {
        const denied = await requirePermission(req, section, action);
        if (denied) return denied;
      }

      for (const [k, v] of Object.entries(body.settings)) {
        const val = JSON.stringify(v ?? null);
        await execute("INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()", [k, val, val]);
      }
      await logActivity("Updated settings", "settings", undefined, `Bulk update: ${keys.join(", ")}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Provide key+value or settings object" }, { status: 400 });
  } catch (error: unknown) {
    // Every write path above requires an admin permission via requirePermission
    // before reaching here (see permissionForKey / SETTINGS_KEY_PERMISSIONS) —
    // unlike GET, this route is never called by public/storefront code, so it's
    // safe to surface the real error instead of a generic message.
    console.error("[PUT /api/settings]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update settings" }, { status: 500 });
  }
}
