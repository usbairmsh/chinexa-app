// Minimal service worker — exists primarily to satisfy PWA installability
// criteria (Chrome/Android require an active SW with a fetch handler before
// it will fire the install prompt). Intentionally does NOT cache API
// responses or pages: this storefront's data (stock, prices, orders) must
// always be fresh, so we only provide a tiny offline fallback for full-page
// navigations and otherwise let every request go straight to the network.
const OFFLINE_URL = "/offline.html";
const CACHE_NAME = "chinexa-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // only guard page loads

  // Only step in when the browser is actually offline — do NOT wrap every
  // navigation in event.respondWith(fetch(event.request)). Re-dispatching the
  // in-flight navigation Request through a second fetch() from the SW thread
  // strips it of the browser's normal HTTP/2 prioritization/connection reuse,
  // and was observed causing Cloudflare (in front of this app) to return 503
  // for that inner fetch — which then became the page's actual response,
  // leaving the tab stuck showing nothing/loading forever. Since this SW
  // exists solely to satisfy install criteria (not to cache pages/API data),
  // there's no upside to intercepting a navigation that isn't going to fail.
  if (!self.navigator.onLine) {
    event.respondWith(
      caches.match(OFFLINE_URL).then((res) => res || Response.error())
    );
  }
});
