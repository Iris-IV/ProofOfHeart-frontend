'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getContribution, getRevenueClaimed, getRevenuePool } from '../lib/contractClient';

interface UseRevenueSharingResult {
  revenuePool: bigint;
  contribution: bigint;
  claimed: bigint;
  contributorShare: bigint;
  claimable: bigint;
  isLoading: boolean;
  refetch: () => void;
}

async function fetchRevenueSharing(
  id: number,
  walletAddress: string | null,
): Promise<{ pool: bigint; contribution: bigint; claimed: bigint }> {
  const [pool, contribution, claimed] = await Promise.all([
    getRevenuePool(id),
    walletAddress ? getContribution(id, walletAddress) : Promise.resolve(BigInt(0)),
    walletAddress ? getRevenueClaimed(id, walletAddress) : Promise.resolve(BigInt(0)),
  ]);
  return { pool, contribution, claimed };
}

export function useRevenueSharing(
  campaignId: number | string,
  walletAddress: string | null,
  amountRaised: bigint,
  enabled: boolean,
): UseRevenueSharingResult {
  const id = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['revenueSharing', id, walletAddress],
    queryFn: () => fetchRevenueSharing(id, walletAddress),
    enabled: enabled && !!campaignId && !isNaN(id),
    staleTime: 30_000,
  });

  const pool = data?.pool ?? BigInt(0);
  const contribution = data?.contribution ?? BigInt(0);
  const claimed = data?.claimed ?? BigInt(0);

  const contributorShare =
    amountRaised > BigInt(0) ? (contribution * pool) / amountRaised : BigInt(0);
  const claimable = contributorShare > claimed ? contributorShare - claimed : BigInt(0);

  return {
    revenuePool: pool,
    contribution,
    claimed,
    contributorShare,
    claimable,
    isLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['revenueSharing', id, walletAddress] });
    },
  };
}
