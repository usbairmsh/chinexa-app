import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

// The admin session cookie used to be the admin's raw database id, readable
// and writable by any client-side JS (document.cookie) with zero signature —
// anyone could open devtools and set chinexa-admin-id to a different admin's
// id to fully impersonate them (every requirePermission()/requireSuperadmin()
// check just trusted whatever id showed up in the cookie). This module signs
// the cookie's value the same way OTP tokens are signed (see otp-token.ts) —
// HMAC-SHA256 over a base64url payload — so the id can no longer be forged
// without the server's secret.
//
// Lazy secret check (inside sign(), not at module load) for the same reason
// documented in otp-token.ts: Next.js imports this module during the build's
// page-data-collection step, before runtime env vars (e.g. docker-compose's
// env_file) are available — throwing at import time breaks `docker compose
// build` outright. Throwing here only fires the first time a real request
// actually needs to sign/verify a session.
function requireSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not set. This must be a long random string kept " +
      "secret in the environment — generate one with `openssl rand -hex 32` " +
      "and set it in .env.production. Refusing to sign with an insecure default."
    );
  }
  return secret;
}

interface AdminSessionPayload {
  adminId: string;
}

function sign(payload: string): string {
  return createHmac("sha256", requireSecret()).update(payload).digest("base64url");
}

export function createAdminSessionToken(adminId: string): string {
  const body = Buffer.from(JSON.stringify({ adminId } satisfies AdminSessionPayload)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

/** Verifies the signed session token and returns the admin id, or null if missing/invalid/tampered. */
export function verifyAdminSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expectedSig = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminSessionPayload;
    return payload.adminId || null;
  } catch {
    return null;
  }
}

/** Reads + verifies the admin session cookie off a request — the one place server code should get the caller's admin id from. */
export function getVerifiedAdminId(req: NextRequest): string | null {
  return verifyAdminSessionToken(req.cookies.get("chinexa-admin-id")?.value);
}
