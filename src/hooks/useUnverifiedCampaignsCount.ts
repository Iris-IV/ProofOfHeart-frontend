"use client";

import { useQuery } from "@tanstack/react-query";
import { listCampaigns, initialCampaignsCursor } from "@/lib/contractClient";

const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS) || 60_000;
const RETRY_DELAY_MS = 500;

/**
 * Efficiently counts unverified active campaigns by walking through paginated results
 * instead of fetching all campaigns at once.
 */
async function countUnverifiedCampaigns(): Promise<number> {
  let count = 0;
  let cursor: number | null = initialCampaignsCursor();
  const pageSize = 50;

  while (cursor !== null) {
    const page = await listCampaigns({ cursor, limit: pageSize });
    if (page.campaigns.length === 0) break;

    count += page.campaigns.filter((c) => !c.is_verified && c.is_active && !c.is_cancelled).length;
    cursor = page.nextCursor;
  }

  return count;
}

export interface UseUnverifiedCampaignsCountResult {
  count: number;
  isLoading: boolean;
  error: string | null;
}

export function useUnverifiedCampaignsCount(): UseUnverifiedCampaignsCountResult {
  const { data, isLoading, error } = useQuery<number, Error>({
    queryKey: ["unverifiedCampaignsCount"],
    queryFn: countUnverifiedCampaigns,
    staleTime: POLL_INTERVAL,
    refetchInterval: POLL_INTERVAL,
    retry: 1,
    retryDelay: RETRY_DELAY_MS,
  });

  return {
    count: data ?? 0,
    isLoading,
    error: error?.message ?? null,
  };
}
