import { MAX_FEED_EVENTS, mergeContributionFeed, type ContributionFeedEvent } from "@/lib/contributionFeed";

const event = (id: string, amount = 1n): ContributionFeedEvent => ({
  id, amount, contributor: "GDONOR", ledgerClosedAt: "2026-10-18T12:00:00Z",
});

it("deduplicates replays and sorts newest ledger ids first", () => {
  expect(mergeContributionFeed([event("2")], [event("2"), event("10"), event("1")]).map((item) => item.id))
    .toEqual(["10", "2", "1"]);
});

it("bounds the feed while preserving the newest donations", () => {
  const events = Array.from({ length: 100 }, (_, index) => event(String(index)));
  const merged = mergeContributionFeed([], events);
  expect(merged).toHaveLength(MAX_FEED_EVENTS);
  expect(merged[0].id).toBe("99");
  expect(merged.at(-1)?.id).toBe("80");
  expect(events).toHaveLength(100);
});

it("ignores non-positive amounts", () => {
  expect(mergeContributionFeed([], [event("1", 0n), event("2", -1n)])).toEqual([]);
});
