"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CAMPAIGNS_PAGE_SIZE, listCampaigns } from "../lib/contractClient";
import { Campaign } from "../types";

export interface UseInfiniteCampaignsResult {
  campaigns: Campaign[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: string | null;
  fetchNextPage: () => void;
  refetch: () => void;
}

/**
 * Cursor-paginated campaign listing for the browse/list page (issue #593).
 * Pages are cached and flattened into one array — the virtualized grid
 * renders only what's on screen regardless of how many pages have loaded,
 * so this scales to however many campaigns the contract has without
 * mounting one DOM node per campaign up front.
 *
 * Other consumers (related/trending campaigns, admin dashboard, sitemap)
 * keep using `useCampaigns`/`getAllCampaigns`, which need the full set for
 * cross-campaign filtering and ranking — this hook is specifically for the
 * list UI that can render progressively.
 */
export function useInfiniteCampaigns(
  pageSize: number = DEFAULT_CAMPAIGNS_PAGE_SIZE,
): UseInfiniteCampaignsResult {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useInfiniteQuery({
      queryKey: ["campaigns", "infinite", pageSize],
      queryFn: ({ pageParam }) => listCampaigns({ cursor: pageParam, limit: pageSize }),
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

  const campaigns = useMemo(() => data?.pages.flatMap((page) => page.campaigns) ?? [], [data]);

  return {
    campaigns,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error?.message ?? null,
    fetchNextPage: () => {
      fetchNextPage();
    },
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", "infinite", pageSize] });
    },
  };
}
