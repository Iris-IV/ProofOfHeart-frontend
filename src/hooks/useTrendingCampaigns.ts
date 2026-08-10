"use client";

import { useMemo } from "react";
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

  const trendingCampaigns = useMemo(
    () => getTrendingCampaigns(campaigns, limit),
    [campaigns, limit],
  );

  return {
    trendingCampaigns,
    isLoading,
    error,
    refetch,
  };
}
