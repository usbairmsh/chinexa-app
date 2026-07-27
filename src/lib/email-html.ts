// Shared helpers for composing rich-HTML email bodies (Email Center replies &
// broadcasts). Server-safe (no DOM). The editor emits HTML; we wrap it in an
// email-friendly container and derive a plain-text fallback.

/** Wraps the editor's HTML in a container with sane email defaults so the
 *  formatting renders consistently across clients. */
export function wrapEmailHtml(inner: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#2f3b3a;">${inner || ""}</div>`;
}

/** Best-effort HTML → plain text for the text/* alternative part. Converts a
 *  few block elements to line breaks, strips the rest, and decodes basic
 *  entities. Not a full parser — good enough for a fallback body. */
export function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
