const CACHE = "proofofheart-v1";
const STATIC_ASSETS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(STATIC_ASSETS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache-first for static Next.js assets (immutable hashed files)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Cache-first for static public assets (images, fonts, etc.)
  if (/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|mp4|webm|webp)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first for navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Network-first for Stellar Soroban RPC calls (campaign data)
  if (url.pathname.endsWith("/rpc") || url.hostname.includes("stellar.org")) {
    event.respondWith(networkFirst(request));
    return;
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // If navigating and no cache, return the offline page
    if (request.mode === "navigate") {
      return caches.match("/");
    }
    return new Response("Offline", { status: 503 });
  }
}
