import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { execute } from "@/lib/db";
import { getClientIp } from "@/lib/rate-limit";
import { ensurePageViewsTable } from "@/lib/migrate-analytics";

export const dynamic = "force-dynamic";

// Fire-and-forget page-view beacon. The storefront's PageViewTracker calls
// this (via navigator.sendBeacon) on every route change. It must be cheap,
// never block the page, and never store raw PII.
//
// Privacy model: we never persist the IP or user-agent. Instead we derive a
// per-day visitor hash and a per-window session hash from (ip + ua + salt),
// so "distinct visitors per day" is countable without knowing who anyone is.
// The date is part of the visitor hash, so the same person naturally counts
// as a new visitor each day — matching how basic analytics report "daily
// unique visitors".

const SALT = process.env.ANALYTICS_SALT || "chinexa-analytics-v1";

// Conservative bot sniff — keeps obvious crawlers/monitors out of the human
// traffic counts. Not exhaustive by design; false negatives just slightly
// inflate counts, which is safer than dropping real visitors.
const BOT_RE = /bot|crawl|spider|slurp|bing|google|yandex|duckduck|baidu|semrush|ahrefs|facebookexternalhit|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptime/i;

function hash(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    await ensurePageViewsTable();

    let path = "/";
    try {
      const body = await req.json();
      if (typeof body?.path === "string" && body.path) {
        // Store the pathname only — strip any query string / fragment and cap
        // length. Never trust the client to send a full URL.
        path = body.path.split(/[?#]/)[0].slice(0, 512);
      }
    } catch {
      // sendBeacon can arrive with an empty/al­ternate content-type; default "/"
    }

    // Ignore admin + api paths — this chart is storefront traffic only.
    if (path.startsWith("/admin") || path.startsWith("/api")) {
      return new NextResponse(null, { status: 204 });
    }

    const ua = req.headers.get("user-agent") || "";
    const ip = getClientIp(req);
    const isBot = BOT_RE.test(ua);

    // Day-scoped visitor id (rotates daily) and a coarse session id (also
    // day-scoped here — good enough for the dashboard's visitors line).
    const day = new Date().toISOString().slice(0, 10);
    const visitorId = hash(`${ip}|${ua}|${day}|${SALT}`);
    const sessionId = hash(`${ip}|${ua}|${day}|s|${SALT}`);

    await execute(
      "INSERT INTO page_views (path, visitor_id, session_id, is_bot) VALUES (?, ?, ?, ?)",
      [path, visitorId, sessionId, isBot ? 1 : 0],
    );

    return new NextResponse(null, { status: 204 });
  } catch {
    // Analytics must never surface an error to the visitor — swallow silently.
    return new NextResponse(null, { status: 204 });
  }
}
