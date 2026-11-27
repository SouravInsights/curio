/* Curio service worker.
 *
 * Caches the app shell so the reader boots with no network. Its scope is
 * deliberately narrow: the shell and the hashed build assets, nothing else.
 *
 * It does **not** cache the API. The app is local-first (`curio-<uid>` for
 * marks and the list, `curio-content-<uid>` for bodies), so a second cache under
 * the sync engine would only serve it stale data and fight its cursor. Requests
 * to `/api/*` pass straight through; offline they fail and the app already has
 * an answer on disk.
 *
 * Updates are announced, not forced. There is no `skipWaiting()` here on
 * purpose: an installed window has no reload button, so swapping the controller
 * mid-session would strand the page on the old bundle with no way out. The new
 * worker waits until the page posts `SKIP_WAITING`, which `ServiceWorker.tsx`
 * does only after the reader taps Reload.
 *
 * Strategy:
 * - install  — fetch the shell, pull the entry chunks out of the document, and
 *              cache them, so the *first* visit is enough to boot offline.
 * - assets   — `/_next/static/*` is content-hashed and immutable: cache first.
 * - navigate — network first, falling back to the cached shell.
 *
 * Bump VERSION to evict everything.
 */

const VERSION = "curio-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = "/";
/** Small files the document references but the chunk scan will not catch. */
const EXTRA = ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

// The page asks the waiting worker to take over once the reader accepts the
// update. That triggers `controllerchange` in the page, which reloads.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The app's own data layer owns the API, not this worker.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

async function precache() {
  const shell = await caches.open(SHELL_CACHE);
  const assets = await caches.open(ASSET_CACHE);

  let html;
  try {
    const response = await fetch(SHELL_URL, { cache: "no-cache" });
    if (!response.ok) return;
    html = await response.clone().text();
    await shell.put(SHELL_URL, response);
  } catch {
    return; // offline at install time; runtime caching fills in later
  }

  // Every hashed entry chunk the document points at. `allSettled`, because one
  // missing file must not cost us the rest of the shell.
  const urls = new Set(EXTRA);
  const pattern = /\/_next\/static\/[^"'\\\s)]+/g;
  let match;
  while ((match = pattern.exec(html))) urls.add(match[0]);
  await Promise.allSettled([...urls].map((url) => assets.add(url)));
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) ?? (await cache.match(SHELL_URL));
    if (cached) return cached;
    return new Response("You are offline. Reconnect to load Curio.", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  }
}
