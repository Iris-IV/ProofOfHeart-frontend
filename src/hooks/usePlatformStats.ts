"use client";

import { useMemo } from "react";
import { getAllCampaigns } from "../lib/contractClient";
import { Campaign } from "../types";
import { useQuery } from "@tanstack/react-query";
import { useWindowVisibility } from "./useWindowVisibility";

export interface PlatformStats {
  totalRaisedStroops: bigint;
  campaignCount: number;
}

const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS) || 60_000;

export function usePlatformStats(): { stats: PlatformStats; isLoading: boolean } {
  const isVisible = useWindowVisibility();

  const { data, isLoading } = useQuery<Campaign[], Error>({
    queryKey: ["campaigns"],
    queryFn: getAllCampaigns,
    staleTime: POLL_INTERVAL,
    refetchInterval: isVisible ? POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
  });

  const stats = useMemo<PlatformStats>(() => {
    const campaigns = data ?? [];
    return {
      totalRaisedStroops: campaigns.reduce((sum, c) => sum + c.amount_raised, 0n),
      campaignCount: campaigns.length,
    };
  }, [data]);

  return { stats, isLoading };
}
