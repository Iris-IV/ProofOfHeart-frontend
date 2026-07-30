import { Campaign, calculateFundingPercentage } from "@/types";

/**
 * Calculate momentum / trending score for a campaign.
 * Heuristic factors:
 * 1. Funding progress percentage (0-100+)
 * 2. Active status weight (active campaigns prioritized over finished/failed)
 * 3. Community verification boost (+20 points if verified)
 * 4. Recency bonus based on creation timestamp
 */
export function calculateTrendingScore(
  campaign: Campaign,
  nowSec = Math.floor(Date.now() / 1000),
): number {
  if (campaign.is_cancelled || campaign.status === "cancelled") {
    return -1;
  }

  const progressPct = calculateFundingPercentage(campaign.amount_raised, campaign.funding_goal);

  // Active status weight multiplier
  const isActive = campaign.is_active && campaign.status === "active";
  const statusMultiplier = isActive ? 1.5 : 0.8;

  // Verification bonus
  const verificationBonus = campaign.is_verified ? 20 : 0;

  // Recency bonus: max 30 points for campaigns created within the last 30 days
  const ageInDays = Math.max(0, (nowSec - campaign.created_at) / 86_400);
  const recencyBonus = Math.max(0, 30 - ageInDays);

  return progressPct * statusMultiplier + verificationBonus + recencyBonus;
}

/**
 * Sort and return top trending campaigns.
 * If fewer than limit campaigns meet positive momentum criteria,
 * falls back to non-cancelled active campaigns sorted by funding progress.
 */
export function getTrendingCampaigns(campaigns: Campaign[], limit = 3): Campaign[] {
  const eligible = campaigns.filter((c) => !c.is_cancelled && c.status !== "cancelled");

  if (eligible.length === 0) {
    return [];
  }

  const scored = eligible.map((c) => ({
    campaign: c,
    score: calculateTrendingScore(c),
  }));

  // Sort descending by trending score
  scored.sort((a, b) => b.score - a.score);

  const trending = scored.map((item) => item.campaign);

  return trending.slice(0, limit);
}
