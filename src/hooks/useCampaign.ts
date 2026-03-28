'use client';

import { useState, useEffect } from 'react';
import { Campaign } from '../types';
import { getCampaign } from '../lib/contractClient';

export interface UseCampaignResult {
  campaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

export function useCampaign(id: string | number): UseCampaignResult {
  const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isNaN(numericId)) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setIsLoading(true);
    setError(null);
    setNotFound(false);
    setCampaign(null);

    getCampaign(numericId)
      .then((data) => {
        if (cancelled) return;
        if (data === null) setNotFound(true);
        else setCampaign(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load campaign.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [numericId]);

  return { campaign, isLoading, error, notFound };
}
