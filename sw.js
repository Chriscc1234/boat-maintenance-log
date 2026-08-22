// Offline service worker for the maintenance log app.
// Strategy: NETWORK FIRST, falling back to cache.
//   Online  -> always fetches the latest page, then refreshes the cached copy.
//   Offline -> serves the last good copy from cache.
// CACHE_NAME IS STAMPED BY build-app.sh FROM APP_VERSION. Do not hand-edit it,
// and do not "tidy" the stamp away.
//
// Why it is generated rather than bumped by hand: it was NOT bumped by hand,
// for six releases (1.5.0 through 1.10.0), and that is the whole reason changes
// stopped reaching Chris's iPad. The chain matters —
//
//   an installed iOS app that is RESUMED never re-runs the page load, so the
//   JavaScript already in memory keeps running however new the server copy is;
//   the only thing that reliably replaces it is a NEW SERVICE WORKER, which the
//   browser only notices when THIS FILE'S BYTES CHANGE; and the only thing in
//   here that changes per release is this string.
//
// So a release that does not change this string cannot reach an installed
// device that is never force-quit. The fix is not to remember — it is to make
// the string a function of the version, which build-app.sh now does.
const CACHE_NAME = "boatlog-1.17.1";   // stamped at build

// NO data.enc. It belongs to the retired published-file design and 404s on a
// synced deployment — and cache.addAll REJECTS THE WHOLE LIST if any single
// entry fails, so listing it meant nothing was pre-cached at all and the first
// offline load had no shell to fall back to. The catch below hid that
// completely, which is how it survived this long.
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// Pre-cache the shell on install so the very first offline load works.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Individually, so one missing asset costs only that asset. addAll is
      // all-or-nothing and that is the wrong trade for a shell.
      .then((cache) => Promise.all(
        ASSETS.map((a) => cache.add(a).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
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
