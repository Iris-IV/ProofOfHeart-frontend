'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getCampaign,
  getCampaignCount,
  getContribution,
  getRevenueClaimed,
  getRevenuePool,
} from '../lib/contractClient';
import { getWalletTransactions, WalletTransactionLogEntry } from '../lib/transactionLog';
import { Campaign, CampaignStatus, deriveCampaignStatus } from '../types';

const CACHE_TTL_MS = 60_000;

export interface ContributionHistoryItem {
  campaign: Campaign;
  contribution: bigint;
  status: CampaignStatus;
  canClaimRefund: boolean;
  canClaimRevenue: boolean;
  claimableRevenue: bigint;
  transactions: WalletTransactionLogEntry[];
}

interface UseContributionsResult {
  contributions: ContributionHistoryItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => void;
}

interface CachedContributionHistory {
  fetchedAt: number;
  data: ContributionHistoryItem[];
}

const contributionHistoryCache = new Map<string, CachedContributionHistory>();

function computeClaimableRevenue(
  campaign: Campaign,
  contribution: bigint,
  pool: bigint,
  claimed: bigint,
): bigint {
  if (!campaign.has_revenue_sharing || campaign.amount_raised <= BigInt(0)) return BigInt(0);

  const contributorShare = (contribution * pool) / campaign.amount_raised;
  return contributorShare > claimed ? contributorShare - claimed : BigInt(0);
}

export function useContributions(walletAddress: string | null): UseContributionsResult {
  const [contributions, setContributions] = useState<ContributionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setIsRefreshing(true);
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setContributions([]);
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const cacheKey = walletAddress.toUpperCase();
      const cached = contributionHistoryCache.get(cacheKey);
      const isCacheValid = !!cached && Date.now() - cached.fetchedAt <= CACHE_TTL_MS && tick === 0;

      if (isCacheValid && cached) {
        setContributions(cached.data);
        setError(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (tick === 0) {
        setIsLoading(true);
      }

      try {
        const campaignCount = await getCampaignCount();
        const campaignIds = Array.from({ length: campaignCount }, (_, index) => index + 1);

        const contributionAmounts = await Promise.all(
          campaignIds.map(async (campaignId) => {
            try {
              return await getContribution(campaignId, walletAddress);
            } catch {
              return BigInt(0);
            }
          }),
        );

        const contributedCampaignIds = campaignIds.filter(
          (_, index) => contributionAmounts[index] > BigInt(0),
        );

        const txLog = getWalletTransactions(walletAddress);

        const records = await Promise.all(
          contributedCampaignIds.map(async (campaignId) => {
            const campaign = await getCampaign(campaignId);
            if (!campaign) return null;

            const contributionAmount = contributionAmounts[campaignId - 1];
            const status = deriveCampaignStatus(campaign);
            const canClaimRefund = contributionAmount > BigInt(0) && (status === 'failed' || status === 'cancelled');

            let claimableRevenue = BigInt(0);
            if (campaign.has_revenue_sharing && contributionAmount > BigInt(0)) {
              const [pool, claimed] = await Promise.all([
                getRevenuePool(campaignId),
                getRevenueClaimed(campaignId, walletAddress),
              ]);
              claimableRevenue = computeClaimableRevenue(campaign, contributionAmount, pool, claimed);
            }

            const transactions = txLog.filter((entry) => entry.campaignId === campaignId);

            return {
              campaign,
              contribution: contributionAmount,
              status,
              canClaimRefund,
              canClaimRevenue: claimableRevenue > BigInt(0),
              claimableRevenue,
              transactions,
            } satisfies ContributionHistoryItem;
          }),
        );

        const data = records
          .filter((record): record is ContributionHistoryItem => record !== null)
          .sort((a, b) => {
            const latestA = a.transactions[0]?.timestamp ?? 0;
            const latestB = b.transactions[0]?.timestamp ?? 0;
            if (latestA !== latestB) return latestB - latestA;
            return b.campaign.id - a.campaign.id;
          });

        if (cancelled) return;
        setContributions(data);
        setError(null);
        contributionHistoryCache.set(cacheKey, {
          fetchedAt: Date.now(),
          data,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load contribution history.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [tick, walletAddress]);

  return {
    contributions,
    isLoading,
    isRefreshing,
    error,
    refetch,
  };
}
