// GBH Capital — Service Worker
// Provides offline shell caching and smart network strategies

const CACHE_NAME = "gbh-v1";
const STATIC_CACHE = "gbh-static-v1";

// App shell resources to pre-cache on install
const APP_SHELL = [
  "/dashboard",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.json",
];

// ── Install: pre-cache app shell ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  // Activate immediately instead of waiting
  self.skipWaiting();
});

// ── Activate: clean up old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ── Fetch: smart caching strategies ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Chrome extension requests and external origins
  if (url.protocol === "chrome-extension:" || url.origin !== location.origin) {
    return;
  }

  // API calls → Network First (always fresh data when online)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (images, fonts, icons) → Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Next.js chunks and page navigations → Network First with cache fallback
  event.respondWith(networkFirst(request));
});

// ── Strategy: Network First ──
// Try network, fall back to cache, then offline page
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cache successful responses for offline use
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, return cached dashboard shell
    if (request.mode === "navigate") {
      const shell = await caches.match("/dashboard");
      if (shell) return shell;
    }

    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}

// ── Strategy: Cache First ──
// Serve from cache, update in background
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 404 });
  }
}

// ── Helpers ──
function isStaticAsset(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|eot)$/i.test(
    pathname
  );
}
