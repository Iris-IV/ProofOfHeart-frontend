import { deriveStatus, RawCampaignFlags } from "@/types";

const NOW = Math.floor(Date.now() / 1000);
const PAST = NOW - 86400;
const FUTURE = NOW + 86400;

function flags(overrides: Partial<RawCampaignFlags> = {}): RawCampaignFlags {
  return {
    is_cancelled: false,
    is_verified: false,
    is_active: true,
    funds_withdrawn: false,
    deadline: FUTURE,
    amount_raised: BigInt(0),
    funding_goal: BigInt(100_000_000),
    ...overrides,
  };
}

describe("deriveStatus", () => {
  it("returns 'cancelled' when is_cancelled=true regardless of other flags", () => {
    expect(
      deriveStatus(flags({ is_cancelled: true, is_verified: true, funds_withdrawn: true })),
    ).toBe("cancelled");
    expect(deriveStatus(flags({ is_cancelled: true, is_active: false }))).toBe("cancelled");
  });

  it("returns 'funded' when funds_withdrawn=true and not cancelled", () => {
    expect(deriveStatus(flags({ funds_withdrawn: true }))).toBe("funded");
    expect(deriveStatus(flags({ funds_withdrawn: true, is_verified: true }))).toBe("funded");
  });

  it("returns 'failed' when deadline passed, not active, goal not reached, not cancelled/funded", () => {
    expect(
      deriveStatus(
        flags({
          is_active: false,
          deadline: PAST,
          amount_raised: BigInt(10_000_000),
          funding_goal: BigInt(100_000_000),
        }),
      ),
    ).toBe("failed");
  });

  it("does NOT return 'failed' when goal was reached even if deadline passed", () => {
    const result = deriveStatus(
      flags({
        is_active: false,
        deadline: PAST,
        amount_raised: BigInt(100_000_000),
        funding_goal: BigInt(100_000_000),
      }),
    );
    expect(result).not.toBe("failed");
  });

  it("returns 'verified' when is_verified=true and not cancelled/funded/failed", () => {
    expect(deriveStatus(flags({ is_verified: true }))).toBe("verified");
  });

  it("returns 'active' as fallback for a live unverified campaign", () => {
    expect(deriveStatus(flags())).toBe("active");
  });

  it("returns 'active' when deadline is in future and campaign is active", () => {
    expect(deriveStatus(flags({ is_active: true, deadline: FUTURE }))).toBe("active");
  });

  it("cancelled takes priority over funded", () => {
    expect(deriveStatus(flags({ is_cancelled: true, funds_withdrawn: true }))).toBe("cancelled");
  });

  it("funded takes priority over failed", () => {
    expect(
      deriveStatus(
        flags({
          funds_withdrawn: true,
          is_active: false,
          deadline: PAST,
          amount_raised: BigInt(0),
        }),
      ),
    ).toBe("funded");
  });

  it("failed takes priority over verified when deadline passed and goal not met", () => {
    expect(
      deriveStatus(
        flags({
          is_verified: true,
          is_active: false,
          deadline: PAST,
          amount_raised: BigInt(1),
          funding_goal: BigInt(100_000_000),
        }),
      ),
    ).toBe("failed");
  });
});
