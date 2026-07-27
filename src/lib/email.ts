import { Resend } from "resend";
import { query } from "@/lib/db";
import { type RowDataPacket } from "mysql2/promise";

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
  // The admin-configured email footer (text + ChineXa logo) is appended to
  // EVERY email by default. Set true to omit it for a specific send.
  skipFooter?: boolean;
  // File attachments — Resend takes { filename, content } where content is a
  // base64 string (or Buffer). Callers read files from disk and encode.
  attachments?: { filename: string; content: string }[];
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";

// The footer text is admin-editable (settings key `email_footer`); the logo
// beneath it is fixed. Cached briefly so a burst of sends doesn't hit the DB
// once per email.
let footerCache: { text: string; at: number } | null = null;
const FOOTER_TTL_MS = 60_000;

async function getFooterText(): Promise<string> {
  if (footerCache && Date.now() - footerCache.at < FOOTER_TTL_MS) return footerCache.text;
  let text = "";
  try {
    const rows = await query<RowDataPacket[]>("SELECT value FROM settings WHERE `key` = 'email_footer' LIMIT 1");
    if (rows.length) {
      const raw = rows[0].value;
      let v: unknown = raw;
      if (typeof raw === "string") { try { v = JSON.parse(raw); } catch { v = raw; } }
      if (typeof v === "string") text = v;
    }
  } catch { /* fall back to empty footer text */ }
  footerCache = { text, at: Date.now() };
  return text;
}

function escapeFooterHtml(s: string): string {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

/** Builds the shared footer HTML: admin text (line breaks preserved) then the
 *  fixed ChineXa logo. Returns "" when there's no configured text (logo is only
 *  shown alongside the footer text so we don't stamp a bare logo on everything). */
export function buildFooterHtml(footerText: string): string {
  const t = (footerText || "").trim();
  if (!t) return "";
  const logoUrl = `${SITE_URL}/logo.png`;
  return `
  <div style="max-width:560px;margin:16px auto 0;padding:16px 16px 24px;text-align:left;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="color:#9A8592;font-size:12px;line-height:1.7;white-space:pre-line;">${escapeFooterHtml(t)}</div>
    <div style="margin-top:12px;">
      <a href="${SITE_URL}" style="text-decoration:none;">
        <img src="${logoUrl}" alt="ChineXa" height="32" style="height:32px;width:auto;max-width:160px;display:inline-block;border:0;outline:none;" />
      </a>
    </div>
  </div>`;
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

  // Append the admin-configured footer (text + fixed logo) to every email,
  // unless the caller opts out. Best-effort — a footer read failure must not
  // block the send.
  let html = input.html;
  let text = input.text || input.subject;
  if (!input.skipFooter) {
    const footerText = await getFooterText();
    const footerHtml = buildFooterHtml(footerText);
    if (footerHtml) html = `${html}${footerHtml}`;
    if (footerText.trim()) text = `${text}\n\n${footerText.trim()}\nChineXa`;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: input.subject,
      html,
      // Resend requires html or text; provide a plain-text fallback either way.
      text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.attachments && input.attachments.length ? { attachments: input.attachments } : {}),
    });
    if (error) return { success: false, error: error.message || "Email send failed" };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not reach email provider" };
  }
}
