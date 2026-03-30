'use client';

import { useCallback, useEffect, useState } from 'react';
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

export function useRevenueSharing(
  campaignId: number | string,
  walletAddress: string | null,
  amountRaised: bigint,
  enabled: boolean,
): UseRevenueSharingResult {
  const [revenuePool, setRevenuePool] = useState<bigint>(BigInt(0));
  const [contribution, setContribution] = useState<bigint>(BigInt(0));
  const [claimed, setClaimed] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !campaignId) {
      setRevenuePool(BigInt(0));
      setContribution(BigInt(0));
      setClaimed(BigInt(0));
      setIsLoading(false);
      return;
    }

    const id = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId;
    if (isNaN(id)) return;

    let cancelled = false;
    setIsLoading(true);

    const requests: [Promise<bigint>, Promise<bigint>, Promise<bigint>] = [
      getRevenuePool(id),
      walletAddress ? getContribution(id, walletAddress) : Promise.resolve(BigInt(0)),
      walletAddress ? getRevenueClaimed(id, walletAddress) : Promise.resolve(BigInt(0)),
    ];

    Promise.all(requests)
      .then(([pool, contributionAmount, claimedAmount]) => {
        if (cancelled) return;
        setRevenuePool(pool);
        setContribution(contributionAmount);
        setClaimed(claimedAmount);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch revenue sharing state:', err);
          setRevenuePool(BigInt(0));
          setContribution(BigInt(0));
          setClaimed(BigInt(0));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, enabled, refreshKey, walletAddress]);

  const contributorShare =
    amountRaised > BigInt(0)
      ? (contribution * revenuePool) / amountRaised
      : BigInt(0);
  const claimable = contributorShare > claimed ? contributorShare - claimed : BigInt(0);

  return {
    revenuePool,
    contribution,
    claimed,
    contributorShare,
    claimable,
    isLoading,
    refetch,
  };
}
