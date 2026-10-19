// Versioning: bump this string whenever the caching strategy changes so that
// old caches are pruned on activate. New sw.js versions are picked up via
// registration.update() (see PwaInstaller) without a hard reload.
const CACHE = "proofofheart-v2";

// Image cache for stale-while-revalidate strategy (campaign images, icons)
const IMAGE_CACHE = "proofofheart-images-v2";

// Only immutable, versioned assets are safe to cache at install time. The
// homepage is intentionally excluded: it depends on the locale/state of the
// installing user and addAll would reject on the first offline visit or a
// redirect, failing the whole install. "/" is cached lazily by networkFirst.
const STATIC_ASSETS = ["/manifest.webmanifest"];

// Max age for stale-while-revalidate cache entries (7 days)
const MAX_IMAGE_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

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
      await Promise.all(
        keys.filter((k) => k !== CACHE && k !== IMAGE_CACHE).map((k) => caches.delete(k)),
      );
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

function isCampaignAsset(url) {
  // Campaign images from IPFS gateways or uploaded content
  if (url.hostname.includes("ipfs.io")) return true;
  if (url.hostname.includes("pinata.cloud")) return true;
  if (url.hostname.includes("gateway.pinata.cloud")) return true;
  if (url.pathname.includes("/campaign")) return true;
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(url.pathname)) return true;
  return false;
}

function isIconAsset(url) {
  // Static icons, logos, and SVG graphics
  if (/\.(svg|ico)$/i.test(url.pathname)) return true;
  if (url.pathname.includes("/icon")) return true;
  if (url.pathname.includes("/logo")) return true;
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

  // Stale-while-revalidate for campaign images, icons and visual assets
  // Serves cached content immediately while updating in background
  if (isCampaignAsset(url) || isIconAsset(url)) {
    safeRespondWith(event, staleWhileRevalidate(request));
    return;
  }

  // Cache-first for fonts and videos (large, rarely changing)
  if (/\.(woff2?|ttf|eot|mp4|webm)$/i.test(url.pathname)) {
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

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  // Serve from cache immediately if available
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        // Update cache in background with timestamp
        const responseToCache = response.clone();
        cache.put(request, responseToCache).then(() => {
          // Cleanup old entries (older than MAX_IMAGE_CACHE_AGE)
          cleanupOldCacheEntries(cache);
        });
      }
      return response;
    })
    .catch(() => {
      // Network failed, return cached version if available
      return cached || new Response("Offline", { status: 503 });
    });

  // Return cached version immediately, or wait for network
  return cached || fetchPromise;
}

async function cleanupOldCacheEntries(cache) {
  const requests = await cache.keys();
  const now = Date.now();

  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;

    const cachedDate = response.headers.get("date");
    if (!cachedDate) continue;

    const age = now - new Date(cachedDate).getTime();
    if (age > MAX_IMAGE_CACHE_AGE) {
      await cache.delete(request);
    }
  }
}
