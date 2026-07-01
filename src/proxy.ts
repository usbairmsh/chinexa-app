import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow admin login page without auth
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Skip API routes, static files, and prefetch requests
  if (pathname.startsWith("/admin/api") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Don't redirect on prefetch/RSC requests — just let them through
  // This prevents logout on client-side navigation
  const isPrefetch = request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("rsc") === "1";

  // Protect all other /admin routes
  if (pathname.startsWith("/admin")) {
    const roleCookie = request.cookies.get("chinexa-role")?.value;

    if (roleCookie !== "superadmin" && roleCookie !== "admin") {
      // On prefetch, return empty response instead of redirect
      if (isPrefetch) {
        return new NextResponse(null, { status: 204 });
      }
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
