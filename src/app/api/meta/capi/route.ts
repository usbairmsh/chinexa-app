import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getTrackingConfig } from "@/lib/seo";

export const dynamic = "force-dynamic";

// ─── Meta Conversions API (server-side events) ────────────────────────────────
// The browser pixel drops ~20-40% of events to ad-blockers and iOS tracking
// limits. This mirrors the same events server-side, from our own origin, so Meta
// still receives them. The browser hit and this hit share one event_id, so Meta
// DEDUPLICATES them and counts one conversion — running both is additive
// coverage, not double-counting.
//
// It is intentionally best-effort: any failure returns 200 with {ok:false} and
// is swallowed by the client (fire-and-forget). Analytics must never break a
// customer action.
//
// The access token is a SERVER-ONLY secret read from the settings row — it is
// never sent to the browser (see MetaClientConfig, which omits it).

const GRAPH_VERSION = "v21.0";

/** Meta requires user-identifier fields SHA-256 hashed, lower-cased & trimmed. */
function hash(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/** Phone must be digits-only (no +, spaces or dashes) before hashing. */
function hashPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^0-9]/g, "");
  return digits ? crypto.createHash("sha256").update(digits).digest("hex") : undefined;
}

function clientIp(req: NextRequest): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || undefined;
}

export async function POST(req: NextRequest) {
  try {
    const cfg = await getTrackingConfig();
    const pixelId = (cfg.meta_pixel || "").trim();
    const token = (cfg.meta_capi_token || "").trim();

    // Silently no-op unless CAPI is fully configured AND enabled. Return 200 so
    // the client never logs an error for an intentionally-off integration.
    if (!cfg.meta_events_enabled || !cfg.meta_capi_enabled || !pixelId || !token) {
      return NextResponse.json({ ok: false, skipped: true });
    }

    const body = await req.json().catch(() => ({}));
    const event = String(body.event || "");
    const eventId = String(body.event_id || "");
    if (!event || !eventId) {
      return NextResponse.json({ ok: false, error: "event and event_id required" }, { status: 400 });
    }

    const params = (body.params && typeof body.params === "object" ? body.params : {}) as Record<string, unknown>;

    // user_data: hashed PII (when available) + non-hashed browser signals that
    // improve match quality. fbp/fbc come from the pixel's own cookies.
    const cookieHeader = req.headers.get("cookie") || "";
    const readCookie = (name: string) => {
      const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
      return m ? decodeURIComponent(m[1]) : undefined;
    };

    const userData: Record<string, unknown> = {
      em: hash(body.email),
      ph: hashPhone(body.phone),
      client_user_agent: req.headers.get("user-agent") || undefined,
      client_ip_address: clientIp(req),
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc"),
    };
    // Strip undefined so we don't send empty keys.
    for (const k of Object.keys(userData)) if (userData[k] === undefined) delete userData[k];

    const eventData: Record<string, unknown> = {
      event_name: event,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId, // dedup key shared with the browser pixel
      action_source: "website",
      event_source_url: body.event_source_url || undefined,
      user_data: userData,
      custom_data: params,
    };

    const payload: Record<string, unknown> = { data: [eventData] };
    if (cfg.meta_test_event_code) payload.test_event_code = cfg.meta_test_event_code;

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Log server-side for debugging but don't surface Meta's error to the client.
      console.error("[meta/capi] Graph API error:", res.status, data?.error?.message || data);
      return NextResponse.json({ ok: false });
    }
    return NextResponse.json({ ok: true, events_received: data?.events_received ?? undefined });
  } catch (error) {
    console.error("[meta/capi] failed:", error);
    // Never fail the client — analytics is best-effort.
    return NextResponse.json({ ok: false });
  }
}
