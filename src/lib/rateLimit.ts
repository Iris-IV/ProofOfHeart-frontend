import { getKeyValueStore } from "./persistentStore";

/**
 * Sliding-window rate limiter backed by the shared server store (#1682).
 *
 * Each limiter is an independent namespace with its own window and cap, and
 * counters live in the same store as comments and reports so they survive a
 * restart and are shared across instances.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Returns `true` if the request is allowed, `false` if rate-limited. */
  check: (key: string) => Promise<boolean>;
}

/**
 * Create a rate limiter that allows at most `max` requests per `windowMs`
 * milliseconds for a given key.
 *
 * Keys are typically IP addresses, user-agent hashes, or wallet addresses.
 * `name` namespaces the counters so independent limiters never collide.
 */
export function createRateLimiter(name: string, windowMs: number, max: number): RateLimiter {
  const prefix = `ratelimit:${name}:`;

  async function checkRateLimit(key: string): Promise<boolean> {
    const store = getKeyValueStore();
    const storeKey = `${prefix}${key}`;
    const now = Date.now();

    const entry = await store.get<RateLimitEntry>(storeKey);
    if (!entry || now > entry.resetAt) {
      await store.set(storeKey, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    await store.set(storeKey, { count: entry.count + 1, resetAt: entry.resetAt });
    return true;
  }

  return { check: checkRateLimit };
}

/**
 * Derive a rate-limit key from a NextRequest, preferring a wallet address
 * and falling back to the client IP.
 */
export function rateLimitKeyFromRequest(
  req: { headers: { get(name: string): string | null } },
  walletAddress?: string | null,
): string {
  if (walletAddress) return walletAddress;
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anon"
  );
}
