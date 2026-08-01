import { renderHook, act } from "@testing-library/react";
import { useDonationGracePeriod, resetServerTimeCache } from "@/hooks/useDonationGracePeriod";

// Client clock is 5 minutes BEHIND the server clock.
const CLIENT_NOW = Date.parse("2026-08-01T12:00:00.000Z");
const SERVER_NOW = Date.parse("2026-08-01T12:05:00.000Z");

const originalFetch = globalThis.fetch;

function mockServerTime(serverMs: number | null) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ timestamp: serverMs === null ? "not-a-date" : new Date(serverMs).toISOString() }),
  }) as unknown as typeof fetch;
}

function mockUnreachableServer() {
  globalThis.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
}

async function flushAsync() {
  await act(async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });
}

describe("useDonationGracePeriod", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(CLIENT_NOW);
    resetServerTimeCache();
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("starts the grace period on server-confirmed time when the client clock is skewed", async () => {
    mockServerTime(SERVER_NOW);
    const { result } = renderHook(() => useDonationGracePeriod());
    await flushAsync();

    act(() => {
      result.current.startGracePeriod({
        campaignId: 1,
        campaignTitle: "Test Campaign",
        amount: 10,
        currency: "XLM",
      });
    });

    const donation = result.current.pendingDonations[0];
    expect(donation.timestamp).toBe(SERVER_NOW);
    expect(donation.expiresAt).toBe(SERVER_NOW + 60_000);
  });

  it("purges expired donations using server-confirmed time", async () => {
    mockServerTime(SERVER_NOW);
    const { result } = renderHook(() => useDonationGracePeriod());
    await flushAsync();

    act(() => {
      result.current.startGracePeriod({
        campaignId: 1,
        campaignTitle: "Test Campaign",
        amount: 10,
        currency: "XLM",
      });
    });
    expect(result.current.pendingDonations).toHaveLength(1);

    // Server window is only 60s; client clock is 5 minutes behind, so a
    // client-based purge would keep it around for 5 extra minutes.
    act(() => {
      jest.advanceTimersByTime(61_000);
    });

    expect(result.current.pendingDonations).toHaveLength(0);
  });

  it("falls back to the client clock when the server is unreachable", async () => {
    mockUnreachableServer();
    const { result } = renderHook(() => useDonationGracePeriod());
    await flushAsync();

    act(() => {
      result.current.startGracePeriod({
        campaignId: 1,
        campaignTitle: "Test Campaign",
        amount: 10,
        currency: "XLM",
      });
    });

    const donation = result.current.pendingDonations[0];
    expect(donation.timestamp).toBe(CLIENT_NOW);
    expect(donation.expiresAt).toBe(CLIENT_NOW + 60_000);
  });

  it("ignores an invalid server timestamp and falls back to the client clock", async () => {
    mockServerTime(null);
    const { result } = renderHook(() => useDonationGracePeriod());
    await flushAsync();

    act(() => {
      result.current.startGracePeriod({
        campaignId: 1,
        campaignTitle: "Test Campaign",
        amount: 10,
        currency: "XLM",
      });
    });

    expect(result.current.pendingDonations[0].expiresAt).toBe(CLIENT_NOW + 60_000);
  });
});
