import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { ensureEmailInboxTables } from "@/lib/migrate-email-inbox";
import { getMailboxByAddress, recordInbound, createAttachment } from "@/lib/email-inbox";

export const dynamic = "force-dynamic";

// Inbound-email webhook. The mail provider (Resend inbound, configured as a
// catch-all for the domain) POSTs each received message here. We look up the
// recipient against the configured mailboxes and store it; mail addressed to
// an address we don't run as a mailbox is dropped silently (still 200 so the
// provider doesn't retry).
//
// Auth: a shared secret. Append ?secret=<INBOUND_EMAIL_SECRET> to the webhook
// URL in the provider dashboard (or send it as the x-inbound-secret header).
// Provider-agnostic on purpose — works with Resend/SendGrid/Postmark/Mailgun.
//
// Required env: INBOUND_EMAIL_SECRET.

function extractAddress(v: unknown): { address: string; name: string | null } {
  // Accepts "Name <a@b.com>", "a@b.com", { address, name }, or [ ... ].
  if (Array.isArray(v)) return extractAddress(v[0]);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const addr = typeof o.address === "string" ? o.address : typeof o.email === "string" ? o.email : "";
    const name = typeof o.name === "string" ? o.name : null;
    if (addr) return { address: addr.toLowerCase().trim(), name };
  }
  if (typeof v === "string") {
    const m = v.match(/<([^>]+)>/);
    const addr = (m ? m[1] : v).toLowerCase().trim();
    const name = m ? v.replace(/<[^>]+>/, "").replace(/["']/g, "").trim() || null : null;
    return { address: addr, name };
  }
  return { address: "", name: null };
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === "string" && v.length) return v;
  return null;
}

// Recursively search an object for the first non-empty string value whose key
// matches one of `keys` (case-insensitive). Providers nest the body under
// varying shapes (data.content.html, data.parsed.text, …); this finds it
// wherever it lives without us having to enumerate every provider's schema.
function deepFindString(obj: unknown, keys: string[], depth = 0): string | null {
  if (depth > 5 || obj == null || typeof obj !== "object") return null;
  const lowerKeys = keys.map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim() && lowerKeys.includes(k.toLowerCase())) return v;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const found = deepFindString(v, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    console.error("[inbound-email] INBOUND_EMAIL_SECRET not set — rejecting");
    return NextResponse.json({ error: "Inbound email not configured" }, { status: 503 });
  }
  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-inbound-secret") || "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureEmailInboxTables();

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resend wraps the email in { type, data: {...} }; other providers post the
  // fields at the top level. Handle both.
  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;

  const to = extractAddress(data.to ?? data.recipient ?? data.To);
  const from = extractAddress(data.from ?? data.sender ?? data.From);
  const subject = firstString(data.subject, data.Subject) || "(no subject)";

  // Body: try the common flat field names first, then deep-scan the payload
  // (providers nest it under content/parsed/body objects). This is why a
  // received email could show blank — the body lived under a key we weren't
  // reading. Deep-search finds it wherever it is.
  let bodyHtml = firstString(data.html, data.body_html, data["html_body"], data["stripped-html"]);
  let bodyText = firstString(data.text, data.body_text, data["text_body"], data["stripped-text"], data.plain);
  if (!bodyHtml) bodyHtml = deepFindString(payload, ["html", "body_html", "html_body", "stripped-html", "htmlBody"]);
  if (!bodyText) bodyText = deepFindString(payload, ["text", "body_text", "text_body", "stripped-text", "plain", "textBody", "body"]);

  // Last-resort: if the raw email content is available, keep it so the body is
  // never lost.
  if (!bodyHtml && !bodyText) {
    const raw = firstString(data.raw, data["raw_email"], (data as Record<string, unknown>).rawEmail, deepFindString(payload, ["raw", "raw_email", "content"]));
    if (raw) bodyText = raw;
  }

  // Resend's email.received webhook often carries only metadata + an email id;
  // the full html/text body must be fetched from the API. If we still have no
  // body but do have an id and an API key, pull the full email.
  const foundBodyInline = !!(bodyHtml || bodyText);
  if (!foundBodyInline) {
    const emailId = firstString(data.email_id, data.id, (data as Record<string, unknown>).emailId);
    const apiKey = process.env.RESEND_API_KEY;
    console.error(
      `[inbound-email] no inline body. top keys=${JSON.stringify(Object.keys(payload))} data keys=${JSON.stringify(Object.keys(data))} emailId=${emailId || "NONE"} hasApiKey=${!!apiKey}`
    );
    if (emailId && apiKey) {
      // The webhook carries no body — only an id. Received emails live under
      // Resend's INBOUND endpoint, not /emails/{id} (that's for outbound sends,
      // which 404s for an inbound id). Try the inbound routes first.
      const candidates = [
        `https://api.resend.com/emails/inbound/${emailId}`,
        `https://api.resend.com/inbound/emails/${emailId}`,
        `https://api.resend.com/inbound/${emailId}`,
        `https://api.resend.com/emails/${emailId}`,
      ];
      for (const url of candidates) {
        try {
          const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
          if (r.ok) {
            const full = (await r.json()) as Record<string, unknown>;
            bodyHtml = bodyHtml || firstString(full.html, deepFindString(full, ["html", "body_html", "html_body"]));
            bodyText = bodyText || firstString(full.text, deepFindString(full, ["text", "body_text", "plain"]));
            console.error(`[inbound-email] fetched via ${url}; got body=${!!(bodyHtml || bodyText)} keys=${JSON.stringify(Object.keys(full))}`);
            if (bodyHtml || bodyText) break;
          } else {
            console.error(`[inbound-email] fetch ${url} -> ${r.status}`);
          }
        } catch (err) {
          console.error(`[inbound-email] fetch ${url} error:`, err);
        }
      }
    }
  }

  // Still nothing — dump the full payload so we can map the body field exactly.
  if (!bodyHtml && !bodyText) {
    console.error("[inbound-email] STILL no body. Full payload:", JSON.stringify(payload).slice(0, 6000));
  }

  const headers = (data.headers && typeof data.headers === "object" ? data.headers : {}) as Record<string, unknown>;
  const messageId = firstString(data.message_id, headers["message-id"], headers["Message-ID"]);
  const inReplyTo = firstString(data.in_reply_to, headers["in-reply-to"], headers["In-Reply-To"]);

  if (!to.address || !from.address) {
    // Malformed — ack so the provider doesn't retry a message we can't use.
    return NextResponse.json({ ok: true, dropped: "missing to/from" });
  }

  const mailbox = await getMailboxByAddress(to.address);
  if (!mailbox || !mailbox.is_active || !mailbox.can_receive) {
    // Not one of our configured receiving mailboxes → drop silently.
    return NextResponse.json({ ok: true, dropped: "no matching mailbox" });
  }

  let inboundMessageId: string;
  try {
    const rec = await recordInbound({
      mailbox,
      fromAddress: from.address,
      fromName: from.name,
      subject,
      bodyHtml,
      bodyText,
      messageId,
      inReplyTo,
    });
    inboundMessageId = rec.messageId;
  } catch (err) {
    console.error("[inbound-email] failed to store message:", err);
    // 500 so the provider retries — we don't want to lose real mail on a
    // transient DB error.
    return NextResponse.json({ error: "Could not store message" }, { status: 500 });
  }

  // Store any attachments the provider included (base64 content). Best-effort —
  // a failing attachment must not fail the whole message.
  const rawAttachments = Array.isArray(data.attachments) ? data.attachments : [];
  for (const att of rawAttachments) {
    if (!att || typeof att !== "object") continue;
    const a = att as Record<string, unknown>;
    const filename = firstString(a.filename, a.name, a.file_name) || "attachment";
    const contentType = firstString(a.content_type, a.contentType, a.type) || "application/octet-stream";
    const contentB64 = firstString(a.content, a.data, a.base64);
    if (!contentB64) continue;
    try {
      const buf = Buffer.from(contentB64, "base64");
      if (buf.length === 0 || buf.length > 15 * 1024 * 1024) continue;
      const ext = (filename.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
      const safe = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const dir = path.join(process.cwd(), "public", "uploads", "email");
      if (!existsSync(dir)) await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, safe), buf);
      await createAttachment({
        messageId: inboundMessageId, direction: "inbound",
        filename: filename.replace(/[\r\n"\\]/g, "").slice(0, 255),
        mimeType: contentType, size: buf.length, url: `/api/uploads/email/${safe}`,
      });
    } catch (err) {
      console.error("[inbound-email] attachment store failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
