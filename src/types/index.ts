// ---------------------------------------------------------------------------
// Category enum — mirrors the on-chain Soroban enum exactly
// ---------------------------------------------------------------------------

export enum Category {
  Learner = 0,
  EducationalStartup = 1,
  Educator = 2,
  Publisher = 3,
}

/** Human-readable labels for each Category value. */
export const CATEGORY_LABELS: Record<Category, string> = {
  [Category.Learner]: "Learner",
  [Category.EducationalStartup]: "Educational Startup",
  [Category.Educator]: "Educator",
  [Category.Publisher]: "Publisher",
};

// ---------------------------------------------------------------------------
// Campaign status — derived from contract boolean flags
// ---------------------------------------------------------------------------

export type CampaignStatus = "active" | "cancelled" | "funded" | "failed" | "verified";

// ---------------------------------------------------------------------------
// Campaign interface — mirrors the on-chain Campaign struct
// ---------------------------------------------------------------------------

export interface Campaign {
  id: number;
  creator: string;
  title: string;
  description: string;
  created_at: number; // Unix timestamp in seconds
  status: CampaignStatus;
  funding_goal: bigint;
  deadline: number;
  amount_raised: bigint;
  is_active: boolean;
  funds_withdrawn: boolean;
  is_cancelled: boolean;
  is_verified: boolean;
  category: Category;
  has_revenue_sharing: boolean;
  revenue_share_percentage: number; // basis points (e.g. 300 = 3%)
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Contract error enum — mirrors on-chain error codes
// ---------------------------------------------------------------------------

export enum ContractErrorCode {
  NotAuthorized = 1,
  CampaignNotFound = 2,
  CampaignNotActive = 3,
  FundingGoalMustBePositive = 4,
  InvalidDuration = 5,
  InvalidRevenueShare = 6,
  RevenueShareOnlyForStartup = 7,
  DeadlinePassed = 8,
  ContributionMustBePositive = 9,
  DeadlineNotPassed = 10,
  FundsAlreadyWithdrawn = 11,
  FundingGoalNotReached = 12,
  NoFundsToWithdraw = 13,
  CampaignAlreadyVerified = 14,
  ValidationFailed = 15,
  AlreadyVoted = 16,
  NotTokenHolder = 17,
  VotingQuorumNotMet = 18,
  VotingThresholdNotMet = 19,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive the campaign lifecycle status from its boolean flags + deadline.
 */
export function deriveCampaignStatus(campaign: Campaign): CampaignStatus {
  if (campaign.is_cancelled) return "cancelled";
  if (campaign.funds_withdrawn) return "funded";
  if (
    !campaign.is_active &&
    campaign.deadline < Math.floor(Date.now() / 1000) &&
    campaign.amount_raised < campaign.funding_goal
  ) {
    return "failed";
  }
  if (campaign.is_active) return "active";
  return "active"; // fallback
}

/**
 * Convert stroops (i128) to a floating-point XLM number for display purposes.
 */
export function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}

/**
 * Convert an XLM number to stroops (bigint) for contract calls.
 */
export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}

/**
 * Format basis points as a percentage string for UI display.
 */
export function basisPointsToPercentage(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(basisPoints % 100 === 0 ? 0 : 2)}%`;
}

// ---------------------------------------------------------------------------
// Voting types — UI-only, not part of contract Campaign
// ---------------------------------------------------------------------------

export interface Vote {
  causeId: string;
  voter: string;
  voteType: "upvote" | "downvote";
  timestamp: Date;
  transactionHash: string;
}

// VotingResult is deprecated; use local state shape instead if needed
