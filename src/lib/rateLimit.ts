/**
 * In-memory sliding-window rate limiter.
 *
 * Each limiter is an independent namespace with its own window and cap.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Returns `true` if the request is allowed, `false` if rate-limited. */
  check: (key: string) => boolean;
}

/**
 * Create a rate limiter that allows at most `max` requests per `windowMs`
 * milliseconds for a given key.
 *
 * Keys are typically IP addresses, user-agent hashes, or wallet addresses.
 */
export function createRateLimiter(windowMs: number, max: number): RateLimiter {
  const map = new Map<string, RateLimitEntry>();

  function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = map.get(key);
    if (!entry || now > entry.resetAt) {
      map.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count += 1;
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
