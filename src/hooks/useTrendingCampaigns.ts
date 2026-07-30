"use client";

import { useCampaigns } from "./useCampaigns";
import { getTrendingCampaigns } from "@/lib/trendingHeuristic";
import { Campaign } from "@/types";

interface UseTrendingCampaignsResult {
  trendingCampaigns: Campaign[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTrendingCampaigns(limit = 3): UseTrendingCampaignsResult {
  const { campaigns, isLoading, error, refetch } = useCampaigns();

  const trendingCampaigns = getTrendingCampaigns(campaigns, limit);

  return {
    trendingCampaigns,
    isLoading,
    error,
    refetch,
  };
}
