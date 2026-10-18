"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getContribution, getRevenueClaimed, getRevenuePool } from "../lib/contractClient";
import { parseContractError } from "../utils/contractErrors";

/** Basis-point denominator for revenue split math (100% = 10 000 bps). */
export const REVENUE_SPLIT_BPS_DENOMINATOR = 10_000;

export interface RevenueSplitParams {
  /** Total revenue deposited into the campaign's pool, in stroops. */
  pool: bigint;
  /** Total amount the campaign raised, in stroops. */
  amountRaised: bigint;
  /** The contributor's total contribution, in stroops. */
  contribution: bigint;
  /** Revenue the contributor has already claimed, in stroops. */
  claimed: bigint;
  /**
   * Creator's share of the revenue pool in basis points
   * (campaign.revenue_share_percentage). The community — contributors —
   * shares the remainder pro-rata. Defaults to 0 (whole pool to community),
   * which preserves the pre-split behaviour.
   */
  creatorShareBps?: number;
}

export interface RevenueSplitBreakdown {
  /** Revenue reserved for the campaign creator, in stroops. */
  creatorShare: bigint;
  /** Revenue available to the contributor community, in stroops. */
  communityShare: bigint;
  /** This contributor's pro-rata slice of the community share. */
  contributorShare: bigint;
  /** contributorShare minus what the contributor already claimed (never negative). */
  claimable: bigint;
  /**
   * False when the on-chain values violate split invariants (shares do not
   * sum to the pool, or the contributor's share exceeds the whole community
   * share). The UI should treat this as a client/ledger divergence and
   * re-fetch rather than render the inconsistent numbers.
   */
  isConsistent: boolean;
}

function clampBps(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), REVENUE_SPLIT_BPS_DENOMINATOR);
}

/**
 * Computes the expected creator/community revenue splits from contract
 * parameters, mirroring the on-chain distribution:
 *
 *   creatorShare    = pool × creatorShareBps / 10_000
 *   communityShare  = pool − creatorShare
 *   contributorShare = contribution ÷ amountRaised × communityShare
 *   claimable        = max(0, contributorShare − claimed)
 *
 * Pure bigint math throughout — no floating point — so the displayed splits
 * always match the contract's integer arithmetic.
 */
export function computeRevenueSplits(params: RevenueSplitParams): RevenueSplitBreakdown {
  const { pool, amountRaised, contribution, claimed } = params;
  const creatorShareBps = clampBps(params.creatorShareBps ?? 0);

  const creatorShare = (pool * BigInt(creatorShareBps)) / BigInt(REVENUE_SPLIT_BPS_DENOMINATOR);
  const communityShare = pool - creatorShare;
  const contributorShare =
    amountRaised > BigInt(0) ? (contribution * communityShare) / amountRaised : BigInt(0);
  const claimable = contributorShare > claimed ? contributorShare - claimed : BigInt(0);

  const nonNegative =
    pool >= BigInt(0) &&
    amountRaised >= BigInt(0) &&
    contribution >= BigInt(0) &&
    claimed >= BigInt(0);
  const sharesSumToPool = creatorShare + communityShare === pool;
  const contributorWithinCommunity =
    amountRaised <= BigInt(0) ? contributorShare === BigInt(0) : contributorShare <= communityShare;

  return {
    creatorShare,
    communityShare,
    contributorShare,
    claimable,
    isConsistent: nonNegative && sharesSumToPool && contributorWithinCommunity,
  };
}

interface UseRevenueSharingResult {
  revenuePool: bigint;
  contribution: bigint;
  claimed: bigint;
  contributorShare: bigint;
  claimable: bigint;
  /** Creator's expected cut of the current pool (from campaign.revenue_share_percentage). */
  creatorShare: bigint;
  /** Community (all contributors) cut of the current pool. */
  communityShare: bigint;
  /** False when on-chain values violate split invariants — re-fetch instead of rendering. */
  isStateConsistent: boolean;
  /** Localized error message when the latest fetch failed, otherwise null. */
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
}

export interface UseRevenueSharingOptions {
  /**
   * Creator share of the revenue pool in basis points
   * (pass campaign.revenue_share_percentage). Omit for the legacy behaviour
   * where the entire pool is shared pro-rata among contributors.
   */
  creatorShareBps?: number;
}

async function fetchRevenueSharing(
  id: number,
  walletAddress: string | null,
): Promise<{ pool: bigint; contribution: bigint; claimed: bigint }> {
  const [pool, contribution, claimed] = await Promise.all([
    getRevenuePool(id),
    walletAddress ? getContribution(id, walletAddress) : Promise.resolve(BigInt(0)),
    walletAddress ? getRevenueClaimed(id, walletAddress) : Promise.resolve(BigInt(0)),
  ]);
  return { pool, contribution, claimed };
}

export function useRevenueSharing(
  campaignId: number | string,
  walletAddress: string | null,
  amountRaised: bigint,
  enabled: boolean,
  options?: UseRevenueSharingOptions,
): UseRevenueSharingResult {
  const id = typeof campaignId === "string" ? parseInt(campaignId, 10) : campaignId;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["revenueSharing", id, walletAddress],
    queryFn: () => fetchRevenueSharing(id, walletAddress),
    enabled: enabled && Number.isFinite(id),
    staleTime: 30_000,
    retry: 2,
  });

  const pool = data?.pool ?? BigInt(0);
  const contribution = data?.contribution ?? BigInt(0);
  const claimed = data?.claimed ?? BigInt(0);

  const splits = computeRevenueSplits({
    pool,
    amountRaised,
    contribution,
    claimed,
    creatorShareBps: options?.creatorShareBps,
  });

  return {
    revenuePool: pool,
    contribution,
    claimed,
    contributorShare: splits.contributorShare,
    claimable: splits.claimable,
    creatorShare: splits.creatorShare,
    communityShare: splits.communityShare,
    isStateConsistent: splits.isConsistent,
    error: error ? parseContractError(error) : null,
    isLoading,
    refetch: () => {
      void queryClient.invalidateQueries({ queryKey: ["revenueSharing", id, walletAddress] });
    },
  };
}
