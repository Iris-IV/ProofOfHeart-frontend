"use client";

import { useQuery } from "@tanstack/react-query";
import { getCreatorStats, type ContractCreatorStats } from "../lib/contractClient";

export interface UseCreatorStatsResult {
  stats: ContractCreatorStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCreatorStats(creator: string | null): UseCreatorStatsResult {
  const { data, isLoading, isFetching, error, refetch } = useQuery<ContractCreatorStats, Error>({
    queryKey: ["creatorStats", creator],
    queryFn: () => getCreatorStats(creator!),
    enabled: !!creator,
    staleTime: 60_000,
  });

  return {
    stats: data ?? null,
    isLoading,
    isRefreshing: isFetching && !isLoading,
    error: error?.message ?? null,
    refetch: () => void refetch(),
  };
}
