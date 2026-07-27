import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { sendSms, generateOtpCode } from "@/lib/sms";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { otpEmail } from "@/lib/email-templates";
import { createOtpToken, verifyOtpToken } from "@/lib/otp-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { publicServerError } from "@/lib/validate";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

const OTP_TTL_MINUTES = 5;
// A 6-digit code has 1,000,000 possibilities — with no cap on verify
// attempts, it's brute-forceable well within the 5-minute token lifetime by
// a script firing concurrent requests. Capped per phone+purpose (the actual
// target) and also per IP (so one IP can't grind through many phone numbers).
const VERIFY_MAX_ATTEMPTS = 8;
const VERIFY_WINDOW_MS = 5 * 60 * 1000;
// Sending also costs real money (SMS) and can be used to spam a phone number
// with texts — cap how often a "send" can be requested for the same phone.
const SEND_MAX_ATTEMPTS = 5;
const SEND_WINDOW_MS = 15 * 60 * 1000;

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("+88") && !cleaned.startsWith("+880")) return `+880${cleaned.slice(3)}`;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("88") && cleaned.length === 13) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 11) return `+88${cleaned}`;
  return cleaned;
}

// Stateless OTP — nothing is written to the database. `send` signs the code
// into a token the client holds onto; `verify` checks that token + the code
// the user typed. See src/lib/otp-token.ts for how the signing works.
//
// POST /api/otp — { action: "send", phone, purpose } -> { success, token }
//               | { action: "verify", phone, purpose, code, token } -> { success }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, purpose } = body;
    if (!purpose || typeof purpose !== "string") {
      return NextResponse.json({ error: "purpose is required" }, { status: 400 });
    }

    const phone = normalizePhone((body.phone || "").trim());
    if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });

    const ip = getClientIp(req);

    // ─── SEND ───
    if (action === "send") {
      const byPhone = checkRateLimit(`otp-send:phone:${phone}`, SEND_MAX_ATTEMPTS, SEND_WINDOW_MS);
      const byIp = checkRateLimit(`otp-send:ip:${ip}`, SEND_MAX_ATTEMPTS * 3, SEND_WINDOW_MS);
      if (byPhone.limited || byIp.limited) {
        return NextResponse.json({ error: "Too many codes requested. Please wait a few minutes and try again." }, { status: 429 });
      }

      // Delivery channel — "sms" (default) or "email". Email requires a valid
      // recipient and the email provider to be configured.
      const channel: "sms" | "email" = body.channel === "email" ? "email" : "sms";
      let email = (body.email || "").trim();
      if (channel === "email") {
        // Forgot-password only knows the phone, so for a reset we resolve the
        // account's email server-side by phone (never exposing it to the client).
        if (!email && purpose === "reset") {
          const rawPhone = (body.phone || "").trim();
          const rows = await query<RowDataPacket[]>("SELECT email FROM customers WHERE phone = ? OR phone = ? LIMIT 1", [phone, rawPhone]);
          email = (rows[0]?.email as string) || "";
        }
        if (!email || !email.includes("@")) {
          return NextResponse.json({ error: "No email on file for this account. Please use SMS instead." }, { status: 400 });
        }
        if (!isEmailConfigured()) {
          return NextResponse.json({ error: "Email delivery is not available. Please use SMS instead." }, { status: 400 });
        }
      }

      const code = generateOtpCode();
      const token = createOtpToken({
        phone,
        purpose,
        code,
        exp: Date.now() + OTP_TTL_MINUTES * 60 * 1000,
        channel,
        ...(channel === "email" ? { email } : {}),
      });

      if (channel === "email") {
        const { subject, html, text } = otpEmail(code, "ChineXa", siteUrl, purpose);
        const sent = await sendEmail({ to: email, subject, html, text });
        if (!sent.success) {
          return NextResponse.json({ error: sent.error || "Failed to send OTP email" }, { status: 502 });
        }
        return NextResponse.json({ success: true, message: `Code sent to ${email}`, token });
      }

      const sms = await sendSms(phone, `Your ChineXa verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);
      if (!sms.success) {
        return NextResponse.json({ error: sms.error || "Failed to send OTP" }, { status: 502 });
      }
      return NextResponse.json({ success: true, message: `OTP sent to ${phone}`, token });
    }

    // ─── VERIFY ───
    if (action === "verify") {
      const code = (body.code || "").trim();
      const token = (body.token || "").trim();
      if (!code) return NextResponse.json({ error: "OTP code is required" }, { status: 400 });
      if (!token) return NextResponse.json({ error: "Verification session expired. Please request a new code." }, { status: 400 });

      const byPhone = checkRateLimit(`otp-verify:phone:${phone}`, VERIFY_MAX_ATTEMPTS, VERIFY_WINDOW_MS);
      const byIp = checkRateLimit(`otp-verify:ip:${ip}`, VERIFY_MAX_ATTEMPTS * 3, VERIFY_WINDOW_MS);
      if (byPhone.limited || byIp.limited) {
        return NextResponse.json({ error: "Too many attempts. Please request a new code and try again shortly." }, { status: 429 });
      }

      const payload = verifyOtpToken(token);
      if (!payload) {
        return NextResponse.json({ error: "Invalid or tampered verification session. Please request a new code." }, { status: 400 });
      }
      if (payload.phone !== phone || payload.purpose !== purpose) {
        return NextResponse.json({ error: "Verification session does not match this request." }, { status: 400 });
      }
      if (payload.exp < Date.now()) {
        return NextResponse.json({ error: "OTP has expired. Please request a new code." }, { status: 400 });
      }
      if (payload.code !== code) {
        return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    return publicServerError("POST /api/otp", error);
  }
}
