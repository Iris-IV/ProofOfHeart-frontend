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

  // Derive validity outside the effect so we never call setState
  // synchronously inside the effect body — which ESLint's
  // react-hooks/set-state-in-effect rule forbids.
  const isInvalidId = isNaN(numericId);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(!isInvalidId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Invalid id — nothing to fetch, effect is a no-op.
    if (isInvalidId) return;

    let cancelled = false;

    getCampaign(numericId)
      .then((data) => {
        if (cancelled) return;
        if (data !== null) setCampaign(data);
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
  }, [numericId, isInvalidId]);

  return {
    campaign,
    isLoading,
    error,
    // Derived: invalid id, OR fetch completed with no campaign and no error.
    notFound: isInvalidId || (!isLoading && !error && campaign === null),
  };
}