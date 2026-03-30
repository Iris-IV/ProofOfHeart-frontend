'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Campaign } from '../types';
import { getCampaign } from '../lib/contractClient';

export interface UseCampaignResult {
  campaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => void;
  isRefreshing: boolean;
}

export function useCampaign(id: string | number): UseCampaignResult {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

  const isInvalidId = isNaN(numericId);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(!isInvalidId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const isFirstLoad = useRef(true);

  const refetch = useCallback(() => {
    setIsRefreshing(true);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (isInvalidId) return;

    let cancelled = false;

    getCampaign(numericId)
      .then((data) => {
        if (cancelled) return;
        if (data !== null) setCampaign(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load campaign.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
          isFirstLoad.current = false;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [numericId, isInvalidId, tick]);

  return {
    campaign,
    isLoading,
    isRefreshing,
    error,
    notFound: isInvalidId || (!isLoading && !error && campaign === null),
    refetch,
  };
}