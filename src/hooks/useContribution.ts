'use client';

import { useQuery } from '@tanstack/react-query';
import { getContribution } from '../lib/contractClient';

export function useContribution(campaignId: number | string, userAddress: string | null) {
  const id = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId;

  const { data, isLoading } = useQuery<bigint, Error>({
    queryKey: ['contribution', id, userAddress],
    queryFn: () => getContribution(id, userAddress!),
    enabled: !!userAddress && !!campaignId && !isNaN(id),
    staleTime: 30_000,
  });

  return { contribution: data ?? BigInt(0), isLoading };
}
