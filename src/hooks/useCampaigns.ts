"use client";

import { useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { getCampaignsChunk } from "../lib/contractClient";
import { CAMPAIGNS_CHUNK_SIZE } from "../lib/causesList";
import { Campaign } from "../types";
import { useWindowVisibility } from "./useWindowVisibility";

export interface UseCampaignsResult {
  campaigns: Campaign[];
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isAllLoaded: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL =
  Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS) || 60_000;

export function useCampaigns(): UseCampaignsResult {
  const queryClient = useQueryClient();
  const isVisible = useWindowVisibility();

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["campaigns"],
    queryFn: ({ pageParam }) =>
      getCampaignsChunk(pageParam, CAMPAIGNS_CHUNK_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const nextStart = lastPageParam + CAMPAIGNS_CHUNK_SIZE;
      return nextStart < lastPage.totalCount ? nextStart : undefined;
    },
    staleTime: POLL_INTERVAL,
    refetchInterval: isVisible ? POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
  });

  const campaigns = useMemo(
    () => data?.pages.flatMap((page) => page.campaigns) ?? [],
    [data]
  );

  return {
    campaigns,
    isLoading,
    isRefreshing: isFetching && !isLoading && !isFetchingNextPage,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isAllLoaded: !hasNextPage && !isLoading && !error,
    error: error?.message ?? null,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  };
}
