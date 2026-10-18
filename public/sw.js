// Versioning: bump this string whenever the caching strategy changes so that
// old caches are pruned on activate. New sw.js versions are picked up via
// registration.update() (see PwaInstaller) without a hard reload.
const CACHE = "proofofheart-v1";

// Only immutable, versioned assets are safe to cache at install time. The
// homepage is intentionally excluded: it depends on the locale/state of the
// installing user and addAll would reject on the first offline visit or a
// redirect, failing the whole install. "/" is cached lazily by networkFirst.
const STATIC_ASSETS = ["/manifest.webmanifest"];

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

function isStellarRpcHost(hostname) {
  if (hostname === "soroban-testnet.stellar.org") return true;
  if (hostname === "mainnet.stellar.validationcloud.io") return true;
  if (hostname.endsWith(".stellar.org")) return true;
  return false;
}

function safeRespondWith(event, promise) {
  event.respondWith(promise.catch(() => fetch(event.request)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cache-first for static Next.js assets (immutable hashed files)
  if (url.pathname.startsWith("/_next/static/")) {
    safeRespondWith(event, cacheFirst(request));
    return;
  }

  // Cache-first for static public assets (images, fonts, etc.)
  if (/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|mp4|webm|webp)$/i.test(url.pathname)) {
    safeRespondWith(event, cacheFirst(request));
    return;
  }

  // Network-first for navigation requests (HTML pages)
  if (request.mode === "navigate") {
    safeRespondWith(event, networkFirst(request));
    return;
  }

  // Network-first for Stellar Soroban RPC calls (campaign data)
  if (url.pathname.endsWith("/rpc") || isStellarRpcHost(url.hostname)) {
    safeRespondWith(event, networkFirst(request));
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
