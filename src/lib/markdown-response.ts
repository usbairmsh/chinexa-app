import TurndownService from "turndown";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });

/** Convert admin-authored raw HTML (blog post bodies) into clean Markdown. */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return turndown.turndown(html);
}

/**
 * Rough token-count estimate for the `x-markdown-tokens` response header —
 * agents use this to gauge context-window cost before deciding whether to
 * fetch/parse the body. ~4 characters per token is the standard approximation
 * used when an exact tokenizer isn't available server-side.
 */
function estimateTokens(markdown: string): number {
  return Math.ceil(markdown.length / 4);
}

/** Build a `text/markdown` Response with the standard negotiation headers. */
export function markdownResponse(markdown: string, init?: { status?: number }): Response {
  return new Response(markdown, {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(estimateTokens(markdown)),
      "Vary": "Accept",
    },
  });
}

/** Escape characters that would otherwise break Markdown table cells or emphasis parsing. */
export function mdEscape(text: string): string {
  return String(text ?? "").replace(/[|*_`[\]]/g, "\\$&");
}

/**
 * Wraps a DB-backed markdown route handler so a transient failure (DB down,
 * query error) degrades to a clean 500 markdown document instead of an
 * unhandled exception / raw HTML error page — agents parsing `text/markdown`
 * should never receive a Next.js error page with the wrong Content-Type.
 */
export function withMarkdownErrorHandling(handler: () => Promise<Response>): Promise<Response> {
  return handler().catch((err) => {
    console.error("[markdown route] failed:", err);
    return markdownResponse("# Temporarily Unavailable\n\nThis page could not be loaded right now. Please try again shortly.\n", { status: 500 });
  });
}
