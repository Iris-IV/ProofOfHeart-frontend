"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_CAMPAIGNS_PAGE_SIZE, listCampaigns } from "../lib/contractClient";
import { Campaign, Category } from "../types";

export interface InfiniteCampaignFilters {
  /** Served by the contract's category index (`get_campaigns_by_category`). */
  category?: Category;
  /** Served by the contract's creator index (`get_creator_campaigns`). */
  creator?: string;
}

export interface UseInfiniteCampaignsResult {
  campaigns: Campaign[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  isEmpty: boolean;
  error: string | null;
  fetchNextPage: () => void;
  refetch: () => void;
}

/**
 * Cursor-paginated campaign listing for the browse/list page (issue #593).
 * Pages are cached and flattened into one array — the virtualized grid
 * renders only what's on screen regardless of how many pages have loaded,
 * so this scales to however many campaigns the contract has without
 * mounting one Dom node per campaign up front.
 *
 * Each page is exactly one contract view call (`list_campaigns`, or the
 * category/creator index when `filters` is set), so N visible campaigns cost
 * at most ceil(N / 50) RPC calls. Other consumers (related/trending campaigns,
 * admin dashboard, sitemap) use `useCampaigns`, which needs the full set for
 * cross-campaign ranking.
 */
export function useInfiniteCampaigns(
  pageSize: number = DEFAULT_CAMPAIGNS_PAGE_SIZE,
  filters: InfiniteCampaignFilters = {},
): UseInfiniteCampaignsResult {
  const { category, creator } = filters;
  // Unfiltered listings page by campaign id (1-based); index listings by position (0-based).
  const initialCursor = category !== undefined || creator ? 0 : 1;
  const queryClient = useQueryClient();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, error } =
    useInfiniteQuery({
      queryKey: ["campaigns", "infinite", pageSize, category ?? null, creator ?? null],
      queryFn: ({ pageParam }) =>
        listCampaigns({ cursor: pageParam, limit: pageSize, category, creator }),
      initialPageParam: initialCursor,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

  const campaigns = useMemo(() => data?.pages.flatMap((page) => page.campaigns) ?? [], [data]);

  const isEmpty = !isLoading && campaigns.length === 0;

  return {
    campaigns,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    isEmpty,
    error: error?.message ?? null,
    fetchNextPage: () => {
      fetchNextPage();
    },
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", "infinite"] });
    },
  };
}
