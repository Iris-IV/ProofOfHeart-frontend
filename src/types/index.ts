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

/**
 * Raw on-chain fields used to derive CampaignStatus.
 * Matches the boolean flags the Soroban contract actually stores.
 */
export interface RawCampaignFlags {
  is_cancelled: boolean;
  is_verified: boolean;
  is_active: boolean;
  funds_withdrawn: boolean;
  deadline: number; // Unix timestamp seconds
  amount_raised: bigint;
  funding_goal: bigint;
}

/**
 * Single canonical status derivation used by every view.
 * Priority: cancelled > funded > failed > verified > active
 */
export function deriveStatus(flags: RawCampaignFlags): CampaignStatus {
  if (flags.is_cancelled) return "cancelled";
  if (flags.funds_withdrawn) return "funded";
  const now = Math.floor(Date.now() / 1000);
  if (!flags.is_active && flags.deadline < now && flags.amount_raised < flags.funding_goal) {
    return "failed";
  }
  if (flags.is_verified) return "verified";
  return "active";
}

// ---------------------------------------------------------------------------
// Campaign interface — mirrors the on-chain Campaign struct
// ---------------------------------------------------------------------------

export interface Milestone {
  targetAmount: bigint;
  description: string;
}

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
  cover_image_url?: string;
  milestones?: Milestone[];
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
 * Delegates to deriveStatus so all views use a single derivation path.
 */
export function deriveCampaignStatus(campaign: Campaign): CampaignStatus {
  return deriveStatus(campaign);
}

/**
 * Convert stroops (i128) to a string XLM value for display purposes.
 * This avoids precision loss from number conversion above 2^53.
 */
export function stroopsToXlm(stroops: bigint): string {
  const stroopsStr = stroops.toString();
  if (stroopsStr.length <= 7) {
    // Value is less than 1 XLM, pad with leading zeros
    const padded = stroopsStr.padStart(7, '0');
    const integerPart = '0';
    const fractionalPart = padded.slice(-7);
    // Remove trailing zeros
    const trimmedFractional = fractionalPart.replace(/0+$/, '');
    return trimmedFractional.length > 0 ? `${integerPart}.${trimmedFractional}` : '0';
  } else {
    const integerPart = stroopsStr.slice(0, -7);
    const fractionalPart = stroopsStr.slice(-7);
    // Remove trailing zeros
    const trimmedFractional = fractionalPart.replace(/0+$/, '');
    return trimmedFractional.length > 0 ? `${integerPart}.${trimmedFractional}` : integerPart;
  }
}

/**
 * Convert an XLM string value to stroops (bigint) for contract calls.
 * This avoids precision loss from number conversion above 2^53.
 */
export function xlmToStroops(xlm: string): bigint {
  const trimmed = xlm.trim();
  if (!trimmed) return BigInt(0);
  
  const parts = trimmed.split('.');
  const integerPart = parts[0] || '0';
  const fractionalPart = parts[1] || '';
  
  // Pad or truncate fractional part to exactly 7 digits (stroops precision)
  const paddedFractional = fractionalPart.padEnd(7, '0').slice(0, 7);
  
  const combined = integerPart + paddedFractional;
  return BigInt(combined);
}

/**
 * Calculate funding percentage using bigint arithmetic to avoid precision loss.
 * Returns a number between 0 and 100.
 */
export function calculateFundingPercentage(amountRaised: bigint, fundingGoal: bigint): number {
  if (fundingGoal <= BigInt(0)) return 0;
  // Use bigint arithmetic: (amountRaised * 100) / fundingGoal
  const percentage = (amountRaised * BigInt(100)) / fundingGoal;
  return Math.min(100, Number(percentage));
}

/**
 * Format a stroops bigint as a localized XLM string for display.
 */
export function formatStroopsAsXlm(stroops: bigint, options?: Intl.NumberFormatOptions): string {
  const xlmStr = stroopsToXlm(stroops);
  const xlmNum = parseFloat(xlmStr);
  return xlmNum.toLocaleString(undefined, {
    maximumFractionDigits: 7,
    minimumFractionDigits: 0,
    ...options,
  });
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

// ---------------------------------------------------------------------------
// Campaign Update types — for off-chain signed updates
// ---------------------------------------------------------------------------

/**
 * Represents a campaign update posted by the creator.
 * Updates are stored off-chain and signed by the creator's wallet.
 */
export interface CampaignUpdate {
  id: string;
  campaignId: number;
  content: string;
  authorAddress: string;
  timestamp: number; // Unix timestamp in seconds
  signature: string;
}

/**
 * Payload to be signed when creating a new update.
 * This is what gets signed by the wallet, not the entire update.
 */
export interface UpdatePayload {
  campaignId: number;
  content: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Comment & Q&A types
// ---------------------------------------------------------------------------

export interface Comment {
  id: string;
  campaignId: number;
  content: string;
  authorAddress: string;
  timestamp: number; // Unix timestamp in seconds
  parentId: string | null;
  signature: string;
  isPinned: boolean;
  isReported: boolean;
}

export interface CommentPayload {
  campaignId: number;
  content: string;
  timestamp: number;
}

// VotingResult is deprecated; use local state shape instead if needed
