'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Campaign } from '../types';
import { getAllCampaigns } from '../lib/contractClient';

export interface UseCampaignsResult {
  campaigns: Campaign[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_LISTING_MS) || 60000;

export function useCampaigns(): UseCampaignsResult {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const isFirstLoad = useRef(true);

  const refetch = useCallback(() => {
    setIsRefreshing(true);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getAllCampaigns()
      .then((data) => {
        if (!cancelled) {
          setCampaigns(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load campaigns.');
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
  }, [tick]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isLoading && !isRefreshing) {
        refetch();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isLoading, isRefreshing, refetch]);

  return { campaigns, isLoading, error, refetch };
}
