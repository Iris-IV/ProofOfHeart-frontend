import type { Campaign } from "../types";

/**
 * Deterministic limits in stroops. 0 is an unlimited-cap sentinel for all
 * three contract caps. The lifetime count includes refunded contributions.
 */
export interface DonationLimits {
  maxPerTx: bigint;
  lifetime: bigint;
  personalCap: bigint;
}

export interface DonationAllowance {
  remaining: bigint;
  remainingGoal: bigint;
  remainingCampaignCap: bigint | null;
  remainingPersonalCap: bigint | null;
  maxPerTx: bigint | null;
}

export function calculateDonationAllowance(
  campaign: Pick<Campaign, "funding_goal" | "amount_raised" | "max_contribution_per_user">,
  limits: DonationLimits,
): DonationAllowance {
  const clamp = (value: bigint) => value > 0n ? value : 0n;
  const remainingGoal = clamp(campaign.funding_goal - campaign.amount_raised);
  const perUser = campaign.max_contribution_per_user ?? 0n;
  const remainingCampaignCap = perUser > 0n ? clamp(perUser - limits.lifetime) : null;
  const remainingPersonalCap = limits.personalCap > 0n
    ? clamp(limits.personalCap - limits.lifetime) : null;
  const maxPerTx = limits.maxPerTx > 0n ? limits.maxPerTx : null;
  const candidates = [remainingGoal, remainingCampaignCap, remainingPersonalCap, maxPerTx]
    .filter((candidate): candidate is bigint => candidate !== null);
  const remaining = candidates.reduce((smallest, value) => value < smallest ? value : smallest);
  return { remaining, remainingGoal, remainingCampaignCap, remainingPersonalCap, maxPerTx };
}
