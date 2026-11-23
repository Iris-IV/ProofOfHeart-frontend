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

const UNKNOWN_CLIENT_IP = "unknown-client";

/**
 * Resolve the address supplied by the hosting platform or trusted proxy.
 * The left-most X-Forwarded-For value is client-controlled, so use the
 * right-most proxy hop when the platform does not expose a direct address.
 */
export function getClientIp(req: {
  headers: { get(name: string): string | null };
  ip?: string;
}): string {
  const directIp = req.ip?.trim();
  if (directIp) return directIp;

  const platformIp = req.headers.get("x-vercel-ip")?.trim();
  if (platformIp) return platformIp;

  const forwarded = req.headers.get("x-forwarded-for");
  const hops = forwarded
    ?.split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  const rightMostHop = hops?.at(-1);
  return rightMostHop || UNKNOWN_CLIENT_IP;
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
 * Derive a rate-limit key from a NextRequest using the client IP address.
 *
 * We deliberately ignore any caller-supplied wallet address here. A
 * self-declared address in the request body is not verified, so using it as
 * the rate-limit key lets any client rotate through arbitrary addresses to
 * bypass both the per-request rate limit and the duplicate-report check
 * (#1880).  The IP is the only unforgeable signal available without an
 * on-chain signature verification step.
 */
export function rateLimitKeyFromRequest(
  req: { headers: { get(name: string): string | null }; ip?: string },
): string {
  return getClientIp(req);
}
