"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCampaign,
  getCampaignCount,
  getContribution,
  getRevenueClaimed,
  getRevenuePool,
} from "../lib/contractClient";
import { getWalletTransactions, WalletTransactionLogEntry } from "../lib/transactionLog";
import { Campaign, CampaignStatus, deriveCampaignStatus } from "../types";

export interface ContributionHistoryItem {
  campaign: Campaign;
  contribution: bigint;
  status: CampaignStatus;
  canClaimRefund: boolean;
  canClaimRevenue: boolean;
  claimableRevenue: bigint;
  transactions: WalletTransactionLogEntry[];
}

interface UseContributionsResult {
  contributions: ContributionHistoryItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
}

function computeClaimableRevenue(
  campaign: Campaign,
  contribution: bigint,
  pool: bigint,
  claimed: bigint,
): bigint {
  if (!campaign.has_revenue_sharing || campaign.amount_raised <= BigInt(0)) return BigInt(0);
  const contributorShare = (contribution * pool) / campaign.amount_raised;
  return contributorShare > claimed ? contributorShare - claimed : BigInt(0);
}

async function fetchContributionHistory(walletAddress: string): Promise<ContributionHistoryItem[]> {
  const campaignCount = await getCampaignCount();
  const campaignIds = Array.from({ length: campaignCount }, (_, i) => i + 1);

  const contributionAmounts = await Promise.all(
    campaignIds.map(async (id) => {
      try {
        return await getContribution(id, walletAddress);
      } catch {
        return BigInt(0);
      }
    }),
  );

  const contributedIds = campaignIds.filter((_, i) => contributionAmounts[i] > BigInt(0));
  const txLog = getWalletTransactions(walletAddress);

  const records = await Promise.all(
    contributedIds.map(async (campaignId) => {
      const campaign = await getCampaign(campaignId);
      if (!campaign) return null;

      const contribution = contributionAmounts[campaignId - 1];
      const status = deriveCampaignStatus(campaign);
      const canClaimRefund =
        contribution > BigInt(0) && (status === "failed" || status === "cancelled");

      let claimableRevenue = BigInt(0);
      if (campaign.has_revenue_sharing && contribution > BigInt(0)) {
        const [pool, claimed] = await Promise.all([
          getRevenuePool(campaignId),
          getRevenueClaimed(campaignId, walletAddress),
        ]);
        claimableRevenue = computeClaimableRevenue(campaign, contribution, pool, claimed);
      }

      return {
        campaign,
        contribution,
        status,
        canClaimRefund,
        canClaimRevenue: claimableRevenue > BigInt(0),
        claimableRevenue,
        transactions: txLog.filter((e) => e.campaignId === campaignId),
      } satisfies ContributionHistoryItem;
    }),
  );

  return records
    .filter((r): r is ContributionHistoryItem => r !== null)
    .sort((a, b) => {
      const tA = a.transactions[0]?.timestamp ?? 0;
      const tB = b.transactions[0]?.timestamp ?? 0;
      return tA !== tB ? tB - tA : b.campaign.id - a.campaign.id;
    });
}

export function useContributions(walletAddress: string | null): UseContributionsResult {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery<ContributionHistoryItem[], Error>({
    queryKey: ["contributions", walletAddress],
    queryFn: () => fetchContributionHistory(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 60_000,
  });

  return {
    contributions: data ?? [],
    isLoading,
    isRefreshing: isFetching && !isLoading,
    error: error?.message ?? null,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["contributions", walletAddress] });
    },
  };
}
