"use client";

import { useQuery } from "@tanstack/react-query";
import {
  aggregateCampaignContributors,
  ContributorLeaderboardItem,
} from "@/lib/contributorLeaderboard";
import { useWalletTransactions } from "./useWalletTransactions";

export function useTopContributors(
  campaignId: number,
  userWalletAddress: string | null = null,
  limit = 5,
) {
  const { transactions } = useWalletTransactions(userWalletAddress);

  const { data, isLoading, refetch } = useQuery<ContributorLeaderboardItem[]>({
    queryKey: ["top-contributors", campaignId, userWalletAddress, limit],
    queryFn: () => aggregateCampaignContributors(campaignId, transactions, limit),
    staleTime: 10_000,
  });

  return {
    contributors: data ?? [],
    isLoading,
    refetch,
  };
}
