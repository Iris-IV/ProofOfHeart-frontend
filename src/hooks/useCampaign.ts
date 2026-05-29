'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCampaign } from '../lib/contractClient';
import { Campaign } from '../types';
import { useWindowVisibility } from './useWindowVisibility';

export interface UseCampaignResult {
  campaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Periodic `get_campaign` reconciliation to correct event-stream drift. */
const RECONCILE_INTERVAL =
  Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_DETAIL_MS) || 30_000;

export function useCampaign(id: number): UseCampaignResult {
  const queryClient = useQueryClient();
  const isVisible = useWindowVisibility();

  const { data, isLoading, error } = useQuery<Campaign | null, Error>({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id),
    enabled: !!id,
    staleTime: RECONCILE_INTERVAL,
    refetchOnWindowFocus: true,
    refetchInterval: isVisible ? RECONCILE_INTERVAL : false,
    refetchIntervalInBackground: false,
  });

  return {
    campaign: data ?? null,
    isLoading,
    error: error?.message ?? null,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
    },
  };
}
