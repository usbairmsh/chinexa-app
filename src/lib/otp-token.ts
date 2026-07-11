import { createHmac, timingSafeEqual } from "crypto";

// Stateless OTP: the code/expiry never touch the database. Instead they're
// packed into a token the server HMAC-signs and hands to the client; the
// client returns that same token at verify time so the server can re-derive
// and check the signature without having stored anything.
//
// This means the ENTIRE security of OTP verification (and everything gated
// behind it — password reset, registration) rests on this secret being
// unpredictable. A hardcoded fallback here would be a publicly-known secret
// baked into every deployment of this repo, letting anyone forge a valid
// token for any phone/code/expiry — so a missing env var must fail loudly
// at startup, never silently degrade to a guessable default.
function requireSecret(): string {
  const secret = process.env.OTP_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      "OTP_SIGNING_SECRET is not set. This must be a long random string kept " +
      "secret in the environment — generate one with `openssl rand -hex 32` " +
      "and set it in .env.production. Refusing to start with an insecure default."
    );
  }
  return secret;
}
const SECRET = requireSecret();

interface OtpTokenPayload {
  phone: string;
  purpose: string;
  code: string;
  exp: number; // epoch ms
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createOtpToken(payload: OtpTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyOtpToken(token: string): OtpTokenPayload | null {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return null;

  const expectedSig = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OtpTokenPayload;
  } catch {
    return null;
  }
}
