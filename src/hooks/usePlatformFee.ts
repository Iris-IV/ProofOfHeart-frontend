'use client';

import { useQuery } from '@tanstack/react-query';
import { getPlatformFee } from '../lib/contractClient';

export const DEFAULT_PLATFORM_FEE_BPS = 300;

interface UsePlatformFeeResult {
  platformFeeBps: number;
  isLoading: boolean;
  isFallback: boolean;
}

export function usePlatformFee(): UsePlatformFeeResult {
  const { data, isLoading, isError } = useQuery<number, Error>({
    queryKey: ['platformFee'],
    queryFn: getPlatformFee,
    staleTime: Infinity,
    retry: 1,
  });

  return {
    platformFeeBps: data ?? DEFAULT_PLATFORM_FEE_BPS,
    isLoading,
    isFallback: isError || data === undefined,
  };
}
