jest.mock("@stellar/stellar-sdk", () => {
  const nativeToScVal = (value: unknown, opts: { type: string }) => ({
    __native: value,
    toXDR: () => Buffer.from(`${opts.type}:${String(value)}`),
  });

  const mockGetLatestLedger = jest.fn().mockResolvedValue({ sequence: 1000 });
  const mockGetEvents = jest.fn();

  class MockServer {
    getLatestLedger = mockGetLatestLedger;
    getEvents = mockGetEvents;
  }

  return {
    nativeToScVal,
    scValToNative: (value: { __native?: unknown }) => value.__native,
    rpc: { Server: MockServer },
    __mockGetEvents: mockGetEvents,
    __mockGetLatestLedger: mockGetLatestLedger,
  };
});

import * as StellarSdk from "@stellar/stellar-sdk";
import {
  scValToTopicSegment,
  voteCastTopicFilter,
  isContributionMadeEvent,
  parseContributionAmount,
  sumContributionAmounts,
} from "@/lib/sorobanEvents";

function makeContributionEvent(id: string, campaignId: number, amount: bigint) {
  return {
    id,
    topic: [
      StellarSdk.nativeToScVal("contribution_made", { type: "symbol" }),
      StellarSdk.nativeToScVal(campaignId, { type: "u32" }),
      StellarSdk.nativeToScVal("GABC", { type: "address" }),
    ],
    value: { __bigint: amount },
  };
}

describe("sorobanEvents vote cast", () => {
  it("builds campaign_vote_cast topic filter segments", () => {
    const topics = voteCastTopicFilter(7);
    expect(topics[0][2]).toBe("*");

    const symbol = StellarSdk.nativeToScVal("campaign_vote_cast", { type: "symbol" });
    const campaign = StellarSdk.nativeToScVal(7, { type: "u32" });
    expect(topics[0][0]).toBe(scValToTopicSegment(symbol as never));
    expect(topics[0][1]).toBe(scValToTopicSegment(campaign as never));
  });

  it("identifies contribution_made events for the matching campaign", () => {
    const event = {
      id: "evt-1",
      topic: [
        StellarSdk.nativeToScVal("contribution_made", { type: "symbol" }),
        StellarSdk.nativeToScVal(7, { type: "u32" }),
        StellarSdk.nativeToScVal("GABC", { type: "address" }),
      ],
      value: { __bigint: BigInt(1_000_000) },
    } as unknown as Parameters<typeof isContributionMadeEvent>[0];

    expect(isContributionMadeEvent(event, 7)).toBe(true);
    expect(isContributionMadeEvent(event, 8)).toBe(false);
  });

  it("parses contribution amounts and sums events", () => {
    const event = {
      value: { __bigint: BigInt(2_500_000) },
    } as unknown as Parameters<typeof parseContributionAmount>[0];

    expect(parseContributionAmount(event)).toBe(BigInt(2_500_000));
    expect(sumContributionAmounts([event, event])).toBe(BigInt(5_000_000));
  });
});

describe("subscribeContributionMadeEvents", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_CONTRACT_ADDRESS: "CABC123",
      NEXT_PUBLIC_USE_MOCKS: "false",
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  /**
   * `jest.resetModules()` (in beforeEach) re-runs the stellar-sdk mock factory,
   * so the freshly imported sorobanEvents module holds NEW mock instances. Grab
   * the subscribe fn AND the live mocks from the same fresh module graph.
   */
  async function loadFreshSorobanModule() {
    const mod = await import("@/lib/sorobanEvents");
    const sdk = (await import("@stellar/stellar-sdk")) as unknown as {
      __mockGetEvents: jest.Mock;
    };
    return {
      subscribeContributionMadeEvents: mod.subscribeContributionMadeEvents,
      mockGetEvents: sdk.__mockGetEvents,
    };
  }

  /** Drain the full async chain (getLatestLedger → getEvents → onEvents). */
  async function flushMicrotasks(times = 10) {
    for (let i = 0; i < times; i++) {
      await Promise.resolve();
    }
  }

  it("returns null when event streaming is unavailable", async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_USE_MOCKS: "true",
    };
    jest.resetModules();

    const { subscribeContributionMadeEvents } = await loadFreshSorobanModule();
    const subscription = subscribeContributionMadeEvents({
      campaignId: 1,
      onEvents: jest.fn(),
    });

    expect(subscription).toBeNull();
  });

  it("streams events via cursor and idles between empty polls", async () => {
    const onEvents = jest.fn();
    const { subscribeContributionMadeEvents, mockGetEvents } = await loadFreshSorobanModule();
    mockGetEvents
      .mockResolvedValueOnce({
        events: [makeContributionEvent("evt-1", 7, BigInt(1_000_000))],
        cursor: "cursor-1",
        latestLedger: 1000,
      })
      .mockResolvedValueOnce({
        events: [],
        cursor: "cursor-1",
        latestLedger: 1000,
      });

    const subscription = subscribeContributionMadeEvents({
      campaignId: 7,
      onEvents,
      idleIntervalMs: 5000,
    });

    await flushMicrotasks();
    expect(onEvents).toHaveBeenCalledTimes(1);
    expect(onEvents.mock.calls[0][0].events).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(5000);
    expect(mockGetEvents).toHaveBeenCalledTimes(2);

    subscription?.unsubscribe();
  });

  it("unsubscribes and stops further getEvents calls", async () => {
    const { subscribeContributionMadeEvents, mockGetEvents } = await loadFreshSorobanModule();
    mockGetEvents.mockResolvedValue({
      events: [],
      cursor: "cursor-1",
      latestLedger: 1000,
    });

    const subscription = subscribeContributionMadeEvents({
      campaignId: 7,
      onEvents: jest.fn(),
      idleIntervalMs: 1000,
    });

    await Promise.resolve();
    subscription?.unsubscribe();

    const callsBefore = mockGetEvents.mock.calls.length;
    await jest.advanceTimersByTimeAsync(5000);
    expect(mockGetEvents.mock.calls.length).toBe(callsBefore);
  });
});
