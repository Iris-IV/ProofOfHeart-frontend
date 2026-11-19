import { calculateDonationAllowance } from "@/lib/donationLimits";
import type { Campaign } from "@/types";

const campaign = {
  funding_goal: 1_000_000_000n,
  amount_raised: 100_000_000n,
  max_contribution_per_user: 300_000_000n,
} as Pick<Campaign, "funding_goal" | "amount_raised" | "max_contribution_per_user">;

describe("per-transaction, campaign lifetime and personal caps (#1760)", () => {
  it("takes the smallest non-zero limit, subtracting lifetime even after a refund", () => {
    const allowance = calculateDonationAllowance(campaign, {
      maxPerTx: 150_000_000n,
      lifetime: 225_000_000n,
      personalCap: 250_000_000n,
    });
    expect(allowance.remaining).toBe(25_000_000n);
    expect(allowance.remainingCampaignCap).toBe(75_000_000n);
    expect(allowance.remainingPersonalCap).toBe(25_000_000n);
  });
  it("honors transaction cap even with unlimited personal and campaign caps", () => {
    const allowance = calculateDonationAllowance(
      { ...campaign, max_contribution_per_user: 0n },
      { maxPerTx: 50_000_000n, lifetime: 999_000_000n, personalCap: 0n },
    );
    expect(allowance.remaining).toBe(50_000_000n);
    expect(allowance.remainingPersonalCap).toBeNull();
  });
  it("treats zero caps as unlimited but never exceeds remaining funding goal", () => {
    const allowance = calculateDonationAllowance(
      { ...campaign, amount_raised: 990_000_000n, max_contribution_per_user: 0n },
      { maxPerTx: 0n, lifetime: 0n, personalCap: 0n },
    );
    expect(allowance.remaining).toBe(10_000_000n);
  });
  it("clamps exhausted caps to zero without underflow", () => {
    const allowance = calculateDonationAllowance(campaign, {
      maxPerTx: 0n,
      lifetime: 350_000_000n,
      personalCap: 200_000_000n,
    });
    expect(allowance.remaining).toBe(0n);
  });
});
