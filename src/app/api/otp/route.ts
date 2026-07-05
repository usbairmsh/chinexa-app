import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query, execute } from "@/lib/db";
import { sendSms, generateOtpCode } from "@/lib/sms";

const OTP_TTL_MINUTES = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  if (cleaned.startsWith("+880")) return cleaned;
  if (cleaned.startsWith("+88") && !cleaned.startsWith("+880")) return `+880${cleaned.slice(3)}`;
  if (cleaned.startsWith("880")) return `+${cleaned}`;
  if (cleaned.startsWith("88") && cleaned.length === 13) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 11) return `+88${cleaned}`;
  return cleaned;
}

// POST /api/otp — { action: "send", phone, purpose } | { action: "verify", phone, purpose, code }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, purpose } = body;
    if (!purpose || typeof purpose !== "string") {
      return NextResponse.json({ error: "purpose is required" }, { status: 400 });
    }

    const phone = normalizePhone((body.phone || "").trim());
    if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });

    // ─── SEND ───
    if (action === "send") {
      const recent = await query<RowDataPacket[]>(
        "SELECT created_at FROM otp_codes WHERE phone = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1",
        [phone, purpose]
      );
      if (recent.length > 0) {
        const elapsedMs = Date.now() - new Date(recent[0].created_at as string).getTime();
        if (elapsedMs < RESEND_COOLDOWN_SECONDS * 1000) {
          const waitSec = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
          return NextResponse.json({ error: `Please wait ${waitSec}s before requesting another code` }, { status: 429 });
        }
      }

      const code = generateOtpCode();
      const id = `otp-${Date.now()}`;
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

      const sms = await sendSms(phone, `Your ChineXa verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);
      if (!sms.success) {
        return NextResponse.json({ error: sms.error || "Failed to send OTP" }, { status: 502 });
      }

      await execute(
        "INSERT INTO otp_codes (id, phone, code, purpose, expires_at) VALUES (?, ?, ?, ?, ?)",
        [id, phone, code, purpose, expiresAt.toISOString().slice(0, 19).replace("T", " ")]
      );

      return NextResponse.json({ success: true, message: `OTP sent to ${phone}` });
    }

    // ─── VERIFY ───
    if (action === "verify") {
      const code = (body.code || "").trim();
      if (!code) return NextResponse.json({ error: "OTP code is required" }, { status: 400 });

      const rows = await query<RowDataPacket[]>(
        "SELECT * FROM otp_codes WHERE phone = ? AND purpose = ? AND consumed = FALSE ORDER BY created_at DESC LIMIT 1",
        [phone, purpose]
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: "No OTP request found. Please request a new code." }, { status: 400 });
      }

      const otp = rows[0];

      if (new Date(otp.expires_at as string).getTime() < Date.now()) {
        return NextResponse.json({ error: "OTP has expired. Please request a new code." }, { status: 400 });
      }
      if ((otp.attempts as number) >= MAX_VERIFY_ATTEMPTS) {
        return NextResponse.json({ error: "Too many attempts. Please request a new code." }, { status: 429 });
      }

      if (otp.code !== code) {
        await execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", [otp.id as string]);
        return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
      }

      await execute("UPDATE otp_codes SET consumed = TRUE WHERE id = ?", [otp.id as string]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
