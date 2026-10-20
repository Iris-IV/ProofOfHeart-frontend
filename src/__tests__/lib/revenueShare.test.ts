import {
  creatorClaimableAmount,
  creatorRevenueEntitlement,
  readCreatorClaimed,
  writeCreatorClaimed,
} from "@/lib/revenueShare";

describe("creatorRevenueEntitlement", () => {
  it("is pool × (10,000 − share bps) / 10,000", () => {
    expect(creatorRevenueEntitlement(BigInt(100_000_000), 1000)).toBe(BigInt(90_000_000));
    expect(creatorRevenueEntitlement(BigInt(100_000_000), 0)).toBe(BigInt(100_000_000));
    expect(creatorRevenueEntitlement(BigInt(100_000_000), 10_000)).toBe(BigInt(0));
  });

  it("truncates like the contract's integer division", () => {
    // 7 × 9,999 / 10,000 = 6.9993 -> 6
    expect(creatorRevenueEntitlement(BigInt(7), 1)).toBe(BigInt(6));
  });

  it("never goes negative for out-of-range shares", () => {
    expect(creatorRevenueEntitlement(BigInt(100), 20_000)).toBe(BigInt(0));
  });
});

describe("creatorClaimableAmount", () => {
  it("subtracts what was already claimed and floors at zero", () => {
    expect(creatorClaimableAmount(BigInt(90), BigInt(30))).toBe(BigInt(60));
    expect(creatorClaimableAmount(BigInt(90), BigInt(90))).toBe(BigInt(0));
    expect(creatorClaimableAmount(BigInt(90), BigInt(120))).toBe(BigInt(0));
  });
});

describe("creator claimed bookkeeping", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips per wallet and campaign", () => {
    writeCreatorClaimed(7, "GCREATOR", BigInt(123));
    expect(readCreatorClaimed(7, "GCREATOR")).toBe(BigInt(123));
    expect(readCreatorClaimed(8, "GCREATOR")).toBe(BigInt(0));
    expect(readCreatorClaimed(7, "GOTHER")).toBe(BigInt(0));
    expect(readCreatorClaimed(7, null)).toBe(BigInt(0));
  });

  it("ignores corrupt stored values", () => {
    localStorage.setItem("poh_creator_revenue_claimed_GCREATOR_7", "not-a-number");
    expect(readCreatorClaimed(7, "GCREATOR")).toBe(BigInt(0));
  });
});
