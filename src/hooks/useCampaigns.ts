'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllCampaigns } from '../lib/contractClient';
import { Campaign } from '../types';
import { useWindowVisibility } from './useWindowVisibility';

export interface UseCampaignsResult {
  campaigns: Campaign[];
  isLoading: boolean;
  isRefreshing?: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS) || 60_000;

export function useCampaigns(): UseCampaignsResult {
  const queryClient = useQueryClient();
  const isVisible = useWindowVisibility();

  const { data, isLoading, isFetching, error } = useQuery<Campaign[], Error>({
    queryKey: ['campaigns'],
    queryFn: getAllCampaigns,
    staleTime: POLL_INTERVAL,
    refetchInterval: isVisible ? POLL_INTERVAL : false,
    refetchIntervalInBackground: false,
  });

  return {
    campaigns: data ?? [],
    isLoading,
    isRefreshing: isFetching && !isLoading,
    error: error?.message ?? null,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  };
}
