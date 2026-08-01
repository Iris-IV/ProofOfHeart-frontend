import { render, screen, act } from "@testing-library/react";
import { CancelDonationBanner } from "@/components/CancelDonationBanner";
import { resetServerTimeCache, type PendingDonation } from "@/hooks/useDonationGracePeriod";

// Client clock is 5 minutes BEHIND the server clock.
const CLIENT_NOW = Date.parse("2026-08-01T12:00:00.000Z");
const SERVER_NOW = Date.parse("2026-08-01T12:05:00.000Z");

const originalFetch = globalThis.fetch;

function makeDonation(overrides: Partial<PendingDonation> = {}): PendingDonation {
  return {
    id: "pending_1",
    campaignId: 1,
    campaignTitle: "Test Campaign",
    amount: 10,
    currency: "XLM",
    timestamp: SERVER_NOW,
    expiresAt: SERVER_NOW + 60_000,
    ...overrides,
  };
}

function mockServerTime(serverMs: number) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ timestamp: new Date(serverMs).toISOString() }),
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

describe("CancelDonationBanner", () => {
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

  it("shows the countdown based on server time when the client clock is skewed", async () => {
    // expiresAt is 60s after the SERVER-confirmed deadline. With a client clock
    // 5 minutes behind, a raw Date.now() would show ~360s; the corrected
    // countdown must show 60s.
    mockServerTime(SERVER_NOW);
    render(<CancelDonationBanner pendingDonations={[makeDonation()]} onCancel={jest.fn()} />);
    await flushAsync();

    expect(screen.getByText("60s")).toBeInTheDocument();
  });

  it("shows 0s once the server-confirmed window has actually closed", async () => {
    mockServerTime(SERVER_NOW);
    render(<CancelDonationBanner pendingDonations={[makeDonation()]} onCancel={jest.fn()} />);
    await flushAsync();
    expect(screen.getByText("60s")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(61_000);
    });

    expect(screen.getByText("0s")).toBeInTheDocument();
  });

  it("falls back to the client clock when the server is unreachable", async () => {
    mockUnreachableServer();
    render(
      <CancelDonationBanner
        pendingDonations={[makeDonation({ timestamp: CLIENT_NOW, expiresAt: CLIENT_NOW + 60_000 })]}
        onCancel={jest.fn()}
      />,
    );
    await flushAsync();

    expect(screen.getByText("60s")).toBeInTheDocument();
  });

  it("clamps remaining time at 0 instead of showing negative values", async () => {
    mockServerTime(SERVER_NOW);
    render(
      <CancelDonationBanner
        pendingDonations={[makeDonation({ expiresAt: SERVER_NOW - 10_000 })]}
        onCancel={jest.fn()}
      />,
    );
    await flushAsync();

    expect(screen.getByText("0s")).toBeInTheDocument();
  });
});
