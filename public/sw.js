// SEEDA hub service worker.
//
// One job: when the installed app (or a browser tab) opens a page while the
// device is offline, show a friendly offline page instead of the browser's
// error. Nothing else is cached. Every page shows signed-in, live data, so
// serving an old copy could show someone stale or private information.

const CACHE = "seeda-offline-v2";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove caches from older versions of this file.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // The offline page's own logo: served from the cache when the network fails.
  if (url.origin === self.location.origin && PRECACHE.includes(url.pathname) && url.pathname !== OFFLINE_URL) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(url.pathname)) ?? Response.error()));
    return;
  }
  // Otherwise only page loads are handled; data, scripts and images go straight to the network.
  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
  );
});
