'use client';

import { useState, useEffect } from 'react';
import { getContribution } from '../lib/contractClient';

export function useContribution(campaignId: number | string, userAddress: string | null) {
  const [contribution, setContribution] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userAddress || !campaignId) {
      setContribution(BigInt(0));
      return;
    }

    const id = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId;
    if (isNaN(id)) return;

    setIsLoading(true);
    getContribution(id, userAddress)
      .then(setContribution)
      .catch((err) => console.error('Failed to fetch contribution:', err))
      .finally(() => setIsLoading(false));
  }, [campaignId, userAddress]);

  return { contribution, isLoading };
}
