'use client';

import { useState, useEffect, useCallback } from 'react';
import { Campaign } from '../types';
import { getAllCampaigns } from '../lib/contractClient';

export interface UseCampaignsResult {
  campaigns: Campaign[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCampaigns(): UseCampaignsResult {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setTimeout(() => {
      if (!cancelled) {
        setIsLoading(true);
        setError(null);
      }
    }, 0);

    getAllCampaigns()
      .then((data) => {
        if (!cancelled) setCampaigns(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load campaigns.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { campaigns, isLoading, error, refetch };
}
