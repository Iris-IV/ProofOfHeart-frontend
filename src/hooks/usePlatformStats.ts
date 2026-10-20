"use client";

import { useMemo } from "react";
import { getPlatformStats, type ContractPlatformStats } from "../lib/contractClient";
import { useQuery } from "@tanstack/react-query";
import { useWindowVisibility } from "./useWindowVisibility";

export interface PlatformStats {
  totalRaisedStroops: bigint;
  campaignCount: number;
}

const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS) || 60_000;

/**
 * Platform-wide totals from the contract's `get_platform_stats` view — a single
 * RPC call instead of loading every campaign just to count and sum them.
 */
export function usePlatformStats(): { stats: PlatformStats; isLoading: boolean } {
  const isVisible = useWindowVisibility();

  const { data, isLoading } = useQuery<ContractPlatformStats, Error>({
    queryKey: ["platformStats"],
    queryFn: getPlatformStats,
    staleTime: POLL_INTERVAL,
    refetchInterval: isVisible ? POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
  });

  const stats = useMemo<PlatformStats>(
    () => ({
      totalRaisedStroops: data?.totalAmountRaised ?? 0n,
      campaignCount: data?.totalCampaigns ?? 0,
    }),
    [data],
  );

  return { stats, isLoading };
}
