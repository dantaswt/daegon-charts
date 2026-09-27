const CACHE_NAME = "daegon-charts-v1";
const PRECACHE_URLS = ["/", "/chart/songs", "/chart/albums", "/artists", "/songs", "/albums"];

self.addEventListener("install", (event) => {
  (event as ExtendableEvent).waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  (event as ExtendableEvent).waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.url.includes("/api/")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);

      return cached || fetched;
    }),
  );
});
