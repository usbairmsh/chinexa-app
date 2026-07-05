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
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((res) => res || Response.error())
    )
  );
});
