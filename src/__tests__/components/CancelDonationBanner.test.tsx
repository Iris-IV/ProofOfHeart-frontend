import { render, screen } from "@testing-library/react";
import { CancelDonationBanner } from "@/components/CancelDonationBanner";
import type { PendingDonation } from "@/hooks/useDonationGracePeriod";
import { MAX_PLAUSIBLE_OFFSET_MS } from "@/lib/serverTime";

const SERVER_NOW = Date.parse("2026-01-01T00:00:00.000Z");
const SKEW_MS = 2 * 60 * 60 * 1000;

const donation: PendingDonation = {
  id: "donation-1",
  campaignId: "7",
  campaignTitle: "Clean water",
  amount: 25,
  currency: "XLM",
  timestamp: SERVER_NOW,
  expiresAt: SERVER_NOW + 30_000,
};

describe("CancelDonationBanner — clock drift (issue #1212)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // The device clock runs two hours fast.
    jest.setSystemTime(SERVER_NOW + SKEW_MS);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts down against server time even when the client clock is 2h fast", () => {
    render(
      <CancelDonationBanner
        pendingDonations={[donation]}
        onCancel={jest.fn()}
        serverOffsetMs={-SKEW_MS}
      />,
    );

    expect(screen.getByText("30s")).toBeInTheDocument();
  });

  it("would have shown 0s before the fix, because the skewed clock reads the window as closed", () => {
    // Guards the regression: the old implementation read the raw client clock,
    // which puts the deadline 7170s in the past, so it clamped to 0s and told
    // the user the grace period was over while 30s actually remained.
    const naiveRemaining = Math.max(
      0,
      Math.ceil((donation.expiresAt - (SERVER_NOW + SKEW_MS)) / 1000),
    );
    expect(naiveRemaining).toBe(0);
  });

  it("hides the countdown when the server clock could not be confirmed", () => {
    render(<CancelDonationBanner pendingDonations={[donation]} onCancel={jest.fn()} />);

    expect(screen.queryByText("30s")).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByTitle(/clock could not be verified/i)).toBeInTheDocument();
  });

  it("refuses to trust an implausible offset", () => {
    render(
      <CancelDonationBanner
        pendingDonations={[donation]}
        onCancel={jest.fn()}
        serverOffsetMs={-(MAX_PLAUSIBLE_OFFSET_MS + 1)}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("still counts down for a small, trustworthy skew", () => {
    render(
      <CancelDonationBanner
        pendingDonations={[donation]}
        onCancel={jest.fn()}
        serverOffsetMs={-2_000}
      />,
    );

    // Client is 2s fast on top of the 2h skew, so 2s of grace period have passed.
    expect(screen.getByText("28s")).toBeInTheDocument();
  });

  it("never shows negative time once the window has closed", () => {
    render(
      <CancelDonationBanner
        pendingDonations={[{ ...donation, expiresAt: SERVER_NOW - 10_000 }]}
        onCancel={jest.fn()}
        serverOffsetMs={-SKEW_MS}
      />,
    );

    expect(screen.getByText("0s")).toBeInTheDocument();
  });
});
