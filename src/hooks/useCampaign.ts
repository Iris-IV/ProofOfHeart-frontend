'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_CAMPAIGN_MS) || 20000;

export function useCampaign(id: string | number): UseCampaignResult {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(() => !isNaN(numericId));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(() => isNaN(numericId));
  const [tick, setTick] = useState(0);
  const isFirstLoad = useRef(true);

  const [prevId, setPrevId] = useState(numericId);
  if (numericId !== prevId) {
    setPrevId(numericId);
    setCampaign(null);
    setIsLoading(!isNaN(numericId));
    setNotFound(isNaN(numericId));
    setError(null);
  }

  const refetch = useCallback(() => {
    setIsRefreshing(true);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (isNaN(numericId)) return;

    let cancelled = false;

    getCampaign(numericId)
      .then((data) => {
        if (cancelled) return;
        if (data === null) {
          setNotFound(true);
        } else {
          setCampaign(data);
          setNotFound(false);
        }
        setError(null);
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
  }, [numericId, tick]);

  useEffect(() => {
    if (isNaN(numericId)) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isLoading && !isRefreshing) {
        refetch();
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [numericId, isLoading, isRefreshing, refetch]);

  return { campaign, isLoading, error, notFound, refetch, isRefreshing };
}
