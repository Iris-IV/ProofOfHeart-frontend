'use client';

import { useEffect, useState } from 'react';
import { getPlatformFee } from '../lib/contractClient';

export const DEFAULT_PLATFORM_FEE_BPS = 300;

interface UsePlatformFeeResult {
  platformFeeBps: number;
  isLoading: boolean;
  isFallback: boolean;
}

export function usePlatformFee(): UsePlatformFeeResult {
  const [platformFeeBps, setPlatformFeeBps] = useState(DEFAULT_PLATFORM_FEE_BPS);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPlatformFee()
      .then((fee) => {
        if (cancelled) return;
        setPlatformFeeBps(fee);
        setIsFallback(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPlatformFeeBps(DEFAULT_PLATFORM_FEE_BPS);
        setIsFallback(true);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { platformFeeBps, isLoading, isFallback };
}
