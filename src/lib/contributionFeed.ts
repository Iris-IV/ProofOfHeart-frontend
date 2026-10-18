export interface ContributionFeedEvent {
  id: string;
  contributor: string;
  amount: bigint;
  ledgerClosedAt: string;
}

export type ContributionFeedStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "paused"
  | "unavailable"
  | "mock";

export const MAX_FEED_EVENTS = 20;

/** Newest first, stable across replayed RPC batches, and bounded for long visits. */
export function mergeContributionFeed(
  current: ContributionFeedEvent[],
  incoming: ContributionFeedEvent[],
): ContributionFeedEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) {
    if (event.amount > 0n) byId.set(event.id, event);
  }
  return [...byId.values()]
    .sort((a, b) => b.id.localeCompare(a.id, "en", { numeric: true }))
    .slice(0, MAX_FEED_EVENTS);
}
