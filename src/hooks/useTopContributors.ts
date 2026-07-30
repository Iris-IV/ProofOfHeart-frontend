"use client";

import { useQuery } from "@tanstack/react-query";
import {
  aggregateCampaignContributors,
  ContributorLeaderboardItem,
} from "@/lib/contributorLeaderboard";
import { getWalletTransactions } from "@/lib/transactionLog";

export function useTopContributors(
  campaignId: number,
  userWalletAddress: string | null = null,
  limit = 5,
) {
  const { data, isLoading, refetch } = useQuery<ContributorLeaderboardItem[]>({
    queryKey: ["top-contributors", campaignId, userWalletAddress, limit],
    queryFn: () => {
      const txs = userWalletAddress ? getWalletTransactions(userWalletAddress) : [];
      return aggregateCampaignContributors(campaignId, txs, limit);
    },
    staleTime: 10_000,
  });

  return {
    contributors: data ?? [],
    isLoading,
    refetch,
  };
}
