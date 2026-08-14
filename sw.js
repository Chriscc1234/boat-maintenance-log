// Offline service worker for the maintenance log app.
// Strategy: NETWORK FIRST, falling back to cache.
//   Online  -> always fetches the latest page, then refreshes the cached copy.
//   Offline -> serves the last good copy from cache.
// Bump CACHE_NAME whenever you want to force every device to drop its old cache.

// Bumping this name is what makes every device drop its cached shell.
// is what makes devices drop the old ones.
const CACHE_NAME = "boatlog-v12";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./data.enc",
  "./icon-192.png",
  "./icon-512.png"
];

// Pre-cache the shell on install so the very first offline load works.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   // don't block install if one asset 404s
  );
});

// Drop any older caches when a new version activates.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GETs; let everything else pass through.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Got it from the network — stash a fresh copy for offline use.
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        // Network failed: serve from cache. For navigations, fall back to the
        // page itself so a deep link still opens the log rather than an error.
        caches.match(req).then((hit) =>
          hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)
        )
      )
  );
});

// Lets the page trigger an immediate update.
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
