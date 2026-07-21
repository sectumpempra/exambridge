const VERSION = "exambridge-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;
const CACHE_PREFIX = "exambridge-";
const APP_SHELL = "/";
const CORE = [APP_SHELL, "/manifest.webmanifest", "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, DATA_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const update = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    update.catch(() => undefined);
    return cached;
  }
  return update;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // AI requests and health checks are always live and must never enter PWA caches.
  if (url.pathname.startsWith("/api/ai/")) return;
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          caches.open(SHELL_CACHE).then((cache) => cache.put(APP_SHELL, response.clone()));
        }
        return response;
      }).catch(async () => (await caches.match(APP_SHELL)) || Response.error())
    );
    return;
  }

  if (url.pathname.startsWith("/data/") || url.pathname.startsWith("/knowledge-tree/")) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (/\.(?:js|css|png|svg|ico|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    })));
  }
});
