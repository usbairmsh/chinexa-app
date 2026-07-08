// IndexNow — a shared protocol (supported natively by Bing, Yandex, Seznam.cz,
// Naver, and others) that lets a site push "this URL is new/changed" the
// instant it happens, instead of waiting for the search engine's own crawl
// schedule to rediscover it. Google does not officially consume IndexNow
// pings today, but the protocol costs nothing to have in place and directly
// speeds up discovery on every engine that does support it.
//
// Setup: INDEXNOW_KEY must be a random hex/alphanumeric string, and a file
// named "<key>.txt" containing just that key must be served at the site
// root (https://yourdomain.com/<key>.txt) — see src/app/[key]/route.ts...
// actually served via src/app/api/indexnow-key/route.ts rewritten to root,
// see below. Generate a key once and set it as an env var; never rotate
// without also updating the hosted key file.

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Fire-and-forget — never throws, never blocks the caller (product create/update). */
export async function pingIndexNow(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chinexabd.com";
  if (!key || urls.length === 0) return;

  try {
    const host = new URL(siteUrl).host;
    await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${siteUrl}/${key}.txt`,
        urlList: urls,
      }),
    });
  } catch (err) {
    console.error("[indexnow] ping failed:", err);
  }
}

/** Convenience for a single URL (e.g. right after creating/updating one product). */
export async function pingIndexNowUrl(url: string): Promise<void> {
  return pingIndexNow([url]);
}
