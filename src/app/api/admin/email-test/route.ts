import { NextRequest, NextResponse } from "next/server";
import { type RowDataPacket } from "mysql2/promise";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/admin-permissions-server";
import { sendEmail, isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

// Diagnostics for order emails. Because the order-email path is best-effort
// (swallows all errors so it never breaks an order), a misconfiguration is
// otherwise invisible. This reports exactly which precondition is missing and,
// with ?to=<email>, actually sends a test message and returns the provider's
// real success/error — turning "no email, no idea why" into a precise answer.
export async function GET(req: NextRequest) {
  const denied = await requirePermission(req, "settings", "edit");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to");

  // What the env looks like (booleans only — never leak the key value).
  const config = {
    RESEND_API_KEY_set: !!process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM || null,
    configured: isEmailConfigured(),
  };

  // Toggle + recipient state from settings.
  let features: Record<string, unknown> = {};
  let adminEmails: string[] = [];
  try {
    const f = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'features' LIMIT 1");
    if (f.length) features = (typeof f[0].value === "string" ? JSON.parse(f[0].value) : f[0].value) || {};
  } catch { /* ignore */ }
  try {
    const e = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'order_email' LIMIT 1");
    if (e.length) {
      const cfg = typeof e[0].value === "string" ? JSON.parse(e[0].value) : e[0].value;
      if (Array.isArray(cfg?.admin_emails)) adminEmails = cfg.admin_emails;
    }
  } catch { /* ignore */ }

  const toggles = {
    order_email_customer: features.order_email_customer === true,
    order_email_admin: features.order_email_admin === true,
    order_email_shipped: features.order_email_shipped === true,
    order_email_delivered: features.order_email_delivered === true,
  };

  // Plain-language diagnosis of why a customer confirmation might not send.
  const problems: string[] = [];
  if (!config.RESEND_API_KEY_set) problems.push("RESEND_API_KEY is not set on the server.");
  if (!config.EMAIL_FROM) problems.push("EMAIL_FROM is not set on the server.");
  if (!toggles.order_email_customer) problems.push("The 'Order Email — Customer' toggle is OFF (Settings → Features).");
  problems.push("Customer emails only send when the shopper entered an email at checkout (email is optional there).");
  if (toggles.order_email_admin && adminEmails.length === 0) problems.push("'Order Email — Admin' is on but no admin recipient emails are set (Settings → Notifications).");

  // Optional live test send.
  let testResult: { attempted: boolean; success?: boolean; error?: string } = { attempted: false };
  if (to) {
    if (!to.includes("@")) {
      testResult = { attempted: true, success: false, error: "Invalid ?to= address" };
    } else {
      const r = await sendEmail({
        to,
        subject: "ChineXa email test ✓",
        html: "<p>This is a test email from your ChineXa store. If you can read this, transactional email is working.</p>",
        text: "This is a test email from your ChineXa store. Transactional email is working.",
      });
      testResult = { attempted: true, success: r.success, error: r.error };
    }
  }

  return NextResponse.json({
    config,
    toggles,
    admin_recipients: adminEmails,
    likely_problems: problems,
    test: testResult,
    how_to_test: "Add ?to=you@example.com to actually send a test email and see the provider's real result.",
  });
}
