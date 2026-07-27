import { Resend } from "resend";

// Low-level transactional email sender — mirrors sms.ts: reads config from
// process.env, never throws (always resolves a result object), and returns a
// clear "not configured" result when credentials are absent so callers can stay
// best-effort. Primary transport is Resend; the from-address falls back to a
// sensible default. Server-only — never import into client components.
//
// Required env (set on the VPS via docker-compose, un-prefixed like SMS_API_KEY):
//   RESEND_API_KEY   — Resend API key
//   EMAIL_FROM       — verified sender, e.g. "ChineXa <orders@chinexabd.com>"

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  // Optional sender override, e.g. "ChineXa Support <support@chinexabd.com>".
  // Falls back to EMAIL_FROM when omitted. The address's DOMAIN must be
  // verified in Resend — any address on a verified domain is a valid sender,
  // so per-mailbox from-addresses on one verified domain need no extra setup.
  from?: string;
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendEmail(input: SendEmailInput): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  // Per-send override wins; otherwise the configured default sender.
  const from = input.from || process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { success: false, error: "Email is not configured (missing RESEND_API_KEY/EMAIL_FROM)" };
  }
  const to = (input.to || "").trim();
  if (!to) return { success: false, error: "No recipient email" };

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: input.subject,
      html: input.html,
      // Resend requires html or text; provide a plain-text fallback either way.
      text: input.text || input.subject,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    if (error) return { success: false, error: error.message || "Email send failed" };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not reach email provider" };
  }
}
