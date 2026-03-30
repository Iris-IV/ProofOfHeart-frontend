'use client';

import { useState, useEffect, useCallback } from 'react';
import { Campaign } from '../types';
import { getCampaign } from '../lib/contractClient';

export interface UseCampaignResult {
  campaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCampaign(id: number): UseCampaignResult {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setTimeout(() => {
      setIsLoading(true);
      setError(null);
    }, 0);

    getCampaign(id)
      .then((data) => {
        if (!cancelled) setCampaign(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load campaign.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  return { campaign, isLoading, error, refetch };
}