import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionToken } from "@/lib/admin-session";

// Content pages eligible for markdown negotiation. Cart/checkout/dashboard
// are intentionally excluded — they're interactive, client-rendered UI with
// no stable "document" to convert, not the kind of content an agent would
// want as Markdown. The homepage IS included, but only as a lightweight
// summary + links out to the real content — it's assembled from many
// independent client-side data fetches (banners, featured products, etc.)
// with no single faithful "page" to render as Markdown, so `/md/home`
// deliberately doesn't try to reproduce every homepage section.
const MARKDOWN_ELIGIBLE = [
  /^\/$/,
  /^\/products\/[^/]+$/,
  /^\/blog\/[^/]+$/,
  /^\/policies\/[^/]+$/,
  /^\/categories\/[^/]+$/,
  /^\/brands\/[^/]+$/,
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin auth gate ──
  // Only one proxy.ts is supported per project, so this optimistic session
  // check lives alongside the markdown-negotiation logic below rather than
  // in its own file. Every /admin/* page used to render its full shell with
  // zero server-side check — the layout was client-only and merely left the
  // admin name blank if there was no session, it never redirected — so
  // anyone could load the dashboard UI without logging in at all. This is an
  // *optimistic* check only (cookie signature verified, but no DB round trip
  // — matches Next's own guidance to keep Proxy checks cheap); the DB-backed
  // checks in requirePermission()/requireSuperadmin() remain the real
  // authorization boundary for every actual data-fetching API call.
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const adminId = verifyAdminSessionToken(req.cookies.get("chinexa-admin-id")?.value);
    if (!adminId) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?redirect=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const accept = req.headers.get("accept") || "";
  if (!accept.includes("text/markdown")) return NextResponse.next();
  if (!MARKDOWN_ELIGIBLE.some((re) => re.test(pathname))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/md/home" : `/md${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/", "/products/:slug", "/blog/:slug", "/policies/:slug", "/categories/:slug", "/brands/:slug", "/admin/:path*"],
};
