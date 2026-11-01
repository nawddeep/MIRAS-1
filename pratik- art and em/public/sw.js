// MIRAS service worker. Hand-written and deliberately small.
// - Pre-caches /offline and its scripts/styles. Caches static chunks, app icons and the finite supplied background set on first use.
// - Never touches /api/*: those requests go straight to the network, so an API response is never served from cache.
// - Never caches other HTML pages. Navigations always go to the network and fall back to /offline only when offline.
// Bump VERSION whenever this file or the shell changes; old caches are deleted on activate.

const VERSION = "miras-shell-v3";
const OFFLINE_URL = "/offline";

function strategy(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return "network";
  if (url.pathname.startsWith("/api/")) return "network";
  if (request.mode === "navigate") return "network-then-offline";
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/media/pichhola/") || url.pathname.startsWith("/icons/")) return "cache-first";
  return "network";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const res = await fetch(OFFLINE_URL, { cache: "no-store" });
      if (!res.ok) return;
      const html = await res.clone().text();
      await cache.put(OFFLINE_URL, res);
      // The offline page needs its own scripts and styles to render without a connection.
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
      await Promise.all(assets.map((a) => cache.add(a).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("miras-") && k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const s = strategy(event.request);
  if (s === "network") return; // Not intercepted: the browser fetches it normally.
  if (s === "network-then-offline") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(event.request, copy));
          }
          return res;
        }),
    ),
  );
});
