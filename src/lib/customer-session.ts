import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// ─── Signed customer session ──────────────────────────────────────────────────
// Mirrors admin-session.ts. Before this, a customer "session" was a client-held
// customer_id plus a fake `token-${Date.now()}` string in localStorage — the
// server had no way to bind a request to an authenticated customer, so every
// route that read customer_id from the request body/query was an IDOR: anyone
// could pass another customer's id and act as them.
//
// This issues an HMAC-signed, httpOnly cookie holding the customer id. Routes
// derive the id from the cookie (getVerifiedCustomerId) instead of trusting the
// request, so a caller can only ever act as whoever the cookie says they are —
// and the cookie can't be forged without the server secret.
//
// Reuses ADMIN_SESSION_SECRET so there is one secret to manage; the payload
// shape differs (customerId vs adminId), and the two cookies have different
// names, so a customer cookie can never be replayed as an admin one.

export const CUSTOMER_COOKIE = "chinexa-customer-id";

function requireSecret(): string {
  // Same lazy check + rationale as admin-session.ts: throwing at import time
  // breaks `docker compose build`, which imports this during page-data
  // collection before runtime env is present.
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not set. Generate one with `openssl rand -hex 32` " +
      "and set it in the environment. Refusing to sign a session with no secret."
    );
  }
  return secret;
}

interface CustomerSessionPayload {
  customerId: string;
}

function sign(payload: string): string {
  // Domain-separated from admin tokens so a customer token can never verify as
  // an admin one even if the cookie were somehow swapped.
  return createHmac("sha256", requireSecret()).update(`customer:${payload}`).digest("base64url");
}

export function createCustomerSessionToken(customerId: string): string {
  const body = Buffer.from(JSON.stringify({ customerId } satisfies CustomerSessionPayload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify the signed token, returning the customer id, or null if missing/tampered. */
export function verifyCustomerSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CustomerSessionPayload;
    return payload.customerId || null;
  } catch {
    return null;
  }
}

/** The authenticated customer id from the request cookie, or null. */
export function getVerifiedCustomerId(req: NextRequest): string | null {
  return verifyCustomerSessionToken(req.cookies.get(CUSTOMER_COOKIE)?.value);
}

const THIRTY_DAYS = 30 * 24 * 60 * 60;

/** Set the signed customer session cookie on a response (httpOnly). */
export function setCustomerSessionCookie(res: NextResponse, customerId: string): void {
  res.cookies.set(CUSTOMER_COOKIE, createCustomerSessionToken(customerId), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
  });
}

/** Clear the customer session cookie. */
export function clearCustomerSessionCookie(res: NextResponse): void {
  res.cookies.set(CUSTOMER_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * Resolve the customer id a request is allowed to act as.
 *
 * Returns the cookie's verified id when present. Falls back to a client-supplied
 * id ONLY when there is no session cookie at all AND `allowGuestId` is true —
 * for genuinely guest-accessible flows (guest checkout, guest cart) that predate
 * accounts. When a session exists it ALWAYS wins, so a signed-in customer can
 * never be tricked (or trick the server) into acting as a different id.
 */
export function resolveCustomerId(
  req: NextRequest,
  claimedId: string | null | undefined,
  opts: { allowGuestId?: boolean } = {}
): { id: string | null; authenticated: boolean; forbidden: boolean } {
  const sessionId = getVerifiedCustomerId(req);
  if (sessionId) {
    // A session is present. If the caller also named a DIFFERENT id, that's an
    // IDOR attempt — reject rather than silently using the session id.
    if (claimedId && String(claimedId) !== sessionId) {
      return { id: sessionId, authenticated: true, forbidden: true };
    }
    return { id: sessionId, authenticated: true, forbidden: false };
  }
  if (opts.allowGuestId && claimedId) {
    return { id: String(claimedId), authenticated: false, forbidden: false };
  }
  return { id: null, authenticated: false, forbidden: false };
}
