import { NextRequest, NextResponse } from "next/server";

// Content pages eligible for markdown negotiation. Cart/checkout/dashboard/
// homepage are intentionally excluded — they're interactive, client-rendered
// UI with no stable "document" to convert, not the kind of content an agent
// would want as Markdown.
const MARKDOWN_ELIGIBLE = [
  /^\/products\/[^/]+$/,
  /^\/blog\/[^/]+$/,
  /^\/policies\/[^/]+$/,
  /^\/categories\/[^/]+$/,
  /^\/brands\/[^/]+$/,
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const accept = req.headers.get("accept") || "";

  if (!accept.includes("text/markdown")) return NextResponse.next();
  if (!MARKDOWN_ELIGIBLE.some((re) => re.test(pathname))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/md${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/products/:slug", "/blog/:slug", "/policies/:slug", "/categories/:slug", "/brands/:slug"],
};
