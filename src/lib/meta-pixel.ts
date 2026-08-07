// ─── Meta Pixel — client-side event helper ────────────────────────────────────
// Thin wrapper over the global `fbq` that the base pixel installs (see
// components/shared/tracking-scripts.tsx). Safe to call anywhere: if the pixel
// hasn't loaded (no id configured, blocked, still loading) every call is a
// silent no-op, so event wiring never has to guard on pixel presence.
//
// Every event carries an `eventID`. The SAME id is sent for the browser event
// (here) and the matching server-side Conversions API event, so Meta
// deduplicates them and counts one conversion instead of two. Without this,
// running both the pixel and CAPI double-counts.

type FbqParams = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (
      command: "track" | "trackCustom" | "init",
      eventName: string,
      params?: FbqParams,
      options?: { eventID?: string }
    ) => void;
    /** Set by the base pixel script; gates whether e-commerce events fire. */
    __metaEventsEnabled?: boolean;
  }
}

/** Whether the admin has enabled e-commerce events (base pixel/PageView aside). */
function eventsOn(): boolean {
  return typeof window !== "undefined" && window.__metaEventsEnabled === true;
}

/** Standard Meta e-commerce events we emit. */
export type MetaEvent =
  | "ViewContent"
  | "AddToCart"
  | "AddToWishlist"
  | "InitiateCheckout"
  | "Search"
  | "Purchase";

/** A crypto-random event id, shared between the browser hit and the CAPI hit. */
export function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  // Fallback for older browsers — uniqueness is all that matters for dedup.
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Fire a browser pixel event. No-op if the pixel isn't present.
 * Returns the eventID used (or the one passed in) so the caller can forward the
 * same id to the Conversions API for deduplication.
 */
export function trackMeta(event: MetaEvent, params: FbqParams = {}, eventId?: string): string {
  const id = eventId || newEventId();
  try {
    if (eventsOn() && typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", event, params, { eventID: id });
    }
  } catch {
    /* never let analytics throw into the UI */
  }
  return id;
}

// ── Param builders — keep the shape Meta expects consistent across call sites ──

export interface MetaProductInput {
  id: string;
  name?: string;
  price?: number;
  quantity?: number;
  category?: string | null;
}

/** ViewContent / AddToCart / AddToWishlist for a single product. */
export function productContentParams(p: MetaProductInput): FbqParams {
  return {
    content_type: "product",
    content_ids: [p.id],
    content_name: p.name,
    content_category: p.category || undefined,
    value: typeof p.price === "number" ? Number(p.price) : undefined,
    currency: "BDT",
    ...(p.quantity ? { contents: [{ id: p.id, quantity: p.quantity }] } : {}),
  };
}

/** InitiateCheckout / Purchase for a basket of products. */
export function cartContentParams(items: MetaProductInput[], value: number): FbqParams {
  return {
    content_type: "product",
    content_ids: items.map((i) => i.id),
    contents: items.map((i) => ({ id: i.id, quantity: i.quantity || 1, item_price: i.price })),
    num_items: items.reduce((n, i) => n + (i.quantity || 1), 0),
    value: Number(value) || 0,
    currency: "BDT",
  };
}

/**
 * Forward an event to the server-side Conversions API, reusing the browser
 * event's id for dedup. Fire-and-forget; failure never affects the UI. The
 * server decides whether CAPI is enabled/configured — the client always tries.
 */
export function sendCapi(
  event: MetaEvent,
  eventId: string,
  params: FbqParams,
  extra: { email?: string | null; phone?: string | null; sourceUrl?: string } = {}
): void {
  if (!eventsOn()) return;
  try {
    const body = JSON.stringify({
      event,
      event_id: eventId,
      event_source_url: extra.sourceUrl || (typeof window !== "undefined" ? window.location.href : undefined),
      params,
      email: extra.email || null,
      phone: extra.phone || null,
    });
    fetch("/api/meta/capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true, // survive navigation (e.g. Purchase right before redirect)
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Convenience: fire the browser event AND mirror to CAPI with one shared id. */
export function trackMetaDual(
  event: MetaEvent,
  params: FbqParams,
  extra: { email?: string | null; phone?: string | null } = {}
): string {
  const id = trackMeta(event, params);
  sendCapi(event, id, params, extra);
  return id;
}
