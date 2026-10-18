/**
 * Server-confirmed clock helpers.
 *
 * The client `Date.now()` can be arbitrarily wrong (user-edited system clock,
 * VM resume, missing NTP sync). Countdown UIs that are supposed to mirror an
 * on-chain deadline must not trust it, so we measure the delta between the
 * local clock and a server-issued timestamp and use that offset instead.
 */

/**
 * Sanity bound on a measured offset. A device can legitimately be hours off —
 * that is precisely what we measure and correct — so this only rejects values
 * so large they indicate a bad measurement (stale cache, proxy-injected `Date`,
 * nonsense) rather than a real clock skew.
 */
export const MAX_PLAUSIBLE_OFFSET_MS = 24 * 60 * 60_000;

/** Endpoints that answer cheaply and carry a standard HTTP `Date` header. */
const TIME_ENDPOINT = "/api/health";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Returns `serverTime - clientTime` in milliseconds, or `null` when the server
 * clock could not be confirmed. Assumes a roughly symmetric round trip and
 * subtracts half the observed latency to cancel out most of the network delay.
 */
export async function getServerTimeOffsetMs(
  fetchImpl: FetchLike = fetch,
  endpoint: string = TIME_ENDPOINT,
): Promise<number | null> {
  try {
    const sentAt = Date.now();
    const response = await fetchImpl(endpoint, { cache: "no-store" });
    const receivedAt = Date.now();

    const dateHeader = response.headers?.get?.("date");
    if (!dateHeader) return null;

    const serverTime = new Date(dateHeader).getTime();
    if (Number.isNaN(serverTime)) return null;

    return serverTime - (sentAt + (receivedAt - sentAt) / 2);
  } catch {
    return null;
  }
}

/**
 * True when `offsetMs` is a finite measurement we are willing to count down
 * with. Anything missing, non-numeric or implausibly large is untrusted.
 */
export function isOffsetTrustworthy(offsetMs: number | null | undefined): boolean {
  return (
    typeof offsetMs === "number" &&
    Number.isFinite(offsetMs) &&
    Math.abs(offsetMs) <= MAX_PLAUSIBLE_OFFSET_MS
  );
}

/**
 * Client clock corrected by a trustworthy server offset. Falls back to the raw
 * local clock when no offset is available, so callers that can tolerate an
 * approximate time still get a usable value.
 */
export function nowWithOffset(offsetMs: number | null | undefined, clientNow = Date.now()): number {
  return isOffsetTrustworthy(offsetMs) ? clientNow + (offsetMs as number) : clientNow;
}
