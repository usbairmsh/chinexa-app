import { NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { isSmsConfigured } from "@/lib/sms";

export const dynamic = "force-dynamic";

// Public: tells the (unauthenticated) forgot-password page which OTP channels
// are actually usable for a password reset. A channel is available only when
// the admin has enabled its flag AND the provider is configured on the server
// — so a customer never picks a dead channel, and server env vars are never
// exposed to the client. Drives the show-both / auto-one / block-none logic.
export async function GET() {
  let features: Record<string, unknown> = {};
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'features' LIMIT 1");
    if (rows.length) features = (typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value) || {};
  } catch { /* default: both off */ }

  const sms = features.reset_otp_sms === true && isSmsConfigured();
  const email = features.reset_otp_email === true && isEmailConfigured();

  return NextResponse.json({ sms, email });
}
