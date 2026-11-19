"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCampaign,
  getContributorPortfolio,
  getRevenueClaimed,
  getRevenuePool,
  type ContributorPortfolioPosition,
} from "../lib/contractClient";
import { WalletTransactionLogEntry } from "../lib/transactionLog";
import { Campaign, CampaignStatus, deriveCampaignStatus } from "../types";
import { useWalletTransactions } from "./useWalletTransactions";

export interface ContributionHistoryItem {
  campaign: Campaign;
  campaignName: string;
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

function getCampaignDisplayName(campaign: Campaign, campaignId: number): string {
  const record = campaign as unknown as Record<string, unknown>;
  const title = record.title;
  const name = record.name;
  if (typeof title === "string" && title.trim().length > 0) return title.trim();
  if (typeof name === "string" && name.trim().length > 0) return name.trim();
  return `Campaign #${campaignId}`;
}

const MAX_PORTFOLIO_PAGES = 100;

export async function fetchContributionHistory(
  walletAddress: string,
  txLog: WalletTransactionLogEntry[],
): Promise<ContributionHistoryItem[]> {
  const positions: ContributorPortfolioPosition[] = [];
  let start = 0;

  for (let page = 0; page < MAX_PORTFOLIO_PAGES; page += 1) {
    const result = await getContributorPortfolio(walletAddress, start);
    positions.push(...result.positions);
    if (!result.nextCursor || result.nextCursor <= start) break;
    start = result.nextCursor;
  }

  const campaignsData = await Promise.all(
    positions.map(async (position) => {
      const campaign = await getCampaign(position.campaignId).catch(() => null);
      return { position, campaign };
    }),
  );

  const campaignsToProcess = campaignsData.filter(
    (entry): entry is { position: ContributorPortfolioPosition; campaign: Campaign } =>
      entry.campaign !== null,
  );

  const campaignsWithRevenue = campaignsToProcess.filter(
    (entry) => entry.campaign.has_revenue_sharing,
  );

  const revenueData = await Promise.all(
    campaignsWithRevenue.map(async ({ position }) => {
      const id = position.campaignId;
      try {
        const [pool, claimed] = await Promise.all([
          getRevenuePool(id),
          getRevenueClaimed(id, walletAddress),
        ]);
        return { id, pool, claimed };
      } catch {
        return { id, pool: BigInt(0), claimed: BigInt(0) };
      }
    }),
  );

  const revenueMap = new Map(revenueData.map((r) => [r.id, r]));

  const records: ContributionHistoryItem[] = campaignsToProcess.map(({ position, campaign: c }) => {
    const id = position.campaignId;
    const contribution = position.amount;
    const status = deriveCampaignStatus(c);
    const canClaimRefund = contribution > BigInt(0) && position.refundable;

    let claimableRevenue = BigInt(0);
    if (c.has_revenue_sharing && contribution > BigInt(0)) {
      const revenue = revenueMap.get(id);
      if (revenue) {
        claimableRevenue = computeClaimableRevenue(c, contribution, revenue.pool, revenue.claimed);
      }
    }

    return {
      campaign: c,
      campaignName: getCampaignDisplayName(c, id),
      contribution,
      status,
      canClaimRefund,
      canClaimRevenue: claimableRevenue > BigInt(0),
      claimableRevenue,
      transactions: txLog.filter((e) => e.campaignId === id),
    };
  });

  return records.sort((a, b) => {
    const tA = a.transactions[0]?.timestamp ?? 0;
    const tB = b.transactions[0]?.timestamp ?? 0;
    return tA !== tB ? tB - tA : b.campaign.id - a.campaign.id;
  });
}

export function useContributions(walletAddress: string | null): UseContributionsResult {
  const queryClient = useQueryClient();
  const { transactions } = useWalletTransactions(walletAddress);

  const { data, isLoading, isFetching, error } = useQuery<ContributionHistoryItem[], Error>({
    queryKey: ["contributions", walletAddress],
    queryFn: () => fetchContributionHistory(walletAddress!, transactions),
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
      queryClient.invalidateQueries({ queryKey: ["wallet-transactions", walletAddress] });
    },
  };
}
