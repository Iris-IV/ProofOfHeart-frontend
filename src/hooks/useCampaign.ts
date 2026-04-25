'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCampaign } from '../lib/contractClient';
import { Campaign } from '../types';

export interface UseCampaignResult {
  campaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCampaign(id: number): UseCampaignResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<Campaign, Error>({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id),
    enabled: !!id,
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
