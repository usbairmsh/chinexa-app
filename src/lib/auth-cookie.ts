"use client";

/**
 * Shared cookie-attribute string for every chinexa-role / chinexa-admin-id /
 * chinexa-admin-name write. Adds `Secure` automatically whenever the page is
 * actually served over HTTPS (production) — never in local dev over plain
 * HTTP, where a Secure cookie would silently fail to be set at all and break
 * login entirely. SameSite=Lax matches what every call site already used.
 */
export function authCookieOpts(rememberMe: boolean): string {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  const maxAge = rememberMe ? `; max-age=${7 * 24 * 60 * 60}` : "";
  return `path=/${maxAge}; SameSite=Lax${secure}`;
}
