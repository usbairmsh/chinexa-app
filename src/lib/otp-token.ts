import { createHmac, timingSafeEqual } from "crypto";

// Stateless OTP: the code/expiry never touch the database. Instead they're
// packed into a token the server HMAC-signs and hands to the client; the
// client returns that same token at verify time so the server can re-derive
// and check the signature without having stored anything.
const SECRET = process.env.OTP_SIGNING_SECRET || "dev-only-insecure-otp-secret";

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
