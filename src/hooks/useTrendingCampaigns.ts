"use client";

import { useState, useEffect, useMemo } from "react";
import { useCampaigns } from "./useCampaigns";
import { Campaign, deriveCampaignStatus } from "../types";
import {
  fetchContributionMadeEvents,
  parseContributionAmount,
  parseCampaignId,
} from "../lib/sorobanEvents";

export interface TrendingCampaignData {
  campaign: Campaign;
  recentVelocity: bigint;
}

export interface UseTrendingCampaignsResult {
  trendingCampaigns: TrendingCampaignData[];
  isLoading: boolean;
  error: string | null;
}

export function useTrendingCampaigns(limit: number = 3): UseTrendingCampaignsResult {
  const { campaigns, isLoading: isLoadingCampaigns, error: campaignsError } = useCampaigns();
  const [velocityMap, setVelocityMap] = useState<Map<number, bigint>>(new Map());
  const [isLoadingVelocity, setIsLoadingVelocity] = useState<boolean>(true);
  const [velocityError, setVelocityError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchVelocity = async () => {
      setIsLoadingVelocity(true);
      try {
        // Fetch recent contribution events to calculate velocity
        // Limit to recent 200 events for our simple heuristic
        const result = await fetchContributionMadeEvents({
          limit: 200,
        });

        if (!result || cancelled) return;

        const newVelocityMap = new Map<number, bigint>();

        for (const event of result.events) {
          const campaignId = parseCampaignId(event);
          const amount = parseContributionAmount(event);

          if (campaignId > 0 && amount > BigInt(0)) {
            const currentAmount = newVelocityMap.get(campaignId) || BigInt(0);
            newVelocityMap.set(campaignId, currentAmount + amount);
          }
        }

        if (!cancelled) {
          setVelocityMap(newVelocityMap);
        }
      } catch (err) {
        if (!cancelled) {
          setVelocityError(err instanceof Error ? err.message : "Failed to fetch events");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingVelocity(false);
        }
      }
    };

    void fetchVelocity();

    return () => {
      cancelled = true;
    };
  }, []);

  const trendingCampaigns = useMemo(() => {
    if (!campaigns || campaigns.length === 0) return [];

    // Filter to only active campaigns
    const activeCampaigns = campaigns.filter((c) => {
      const status = deriveCampaignStatus(c);
      return status === "active";
    });

    // Map velocity to active campaigns
    const campaignsWithVelocity: TrendingCampaignData[] = activeCampaigns.map((campaign) => ({
      campaign,
      recentVelocity: velocityMap.get(campaign.id) || BigInt(0),
    }));

    // Check if we have any actual velocity data
    const hasVelocity = Array.from(velocityMap.values()).some((v) => v > BigInt(0));

    if (hasVelocity) {
      // Sort primarily by recent velocity, then by total amount raised
      campaignsWithVelocity.sort((a, b) => {
        if (a.recentVelocity > b.recentVelocity) return -1;
        if (a.recentVelocity < b.recentVelocity) return 1;
        if (a.campaign.amount_raised > b.campaign.amount_raised) return -1;
        if (a.campaign.amount_raised < b.campaign.amount_raised) return 1;
        return 0;
      });
    } else {
      // Fallback: Sort by newest active campaigns
      campaignsWithVelocity.sort((a, b) => {
        if (a.campaign.id > b.campaign.id) return -1;
        if (a.campaign.id < b.campaign.id) return 1;
        return 0;
      });
    }

    return campaignsWithVelocity.slice(0, limit);
  }, [campaigns, velocityMap, limit]);

  return {
    trendingCampaigns,
    isLoading: isLoadingCampaigns || isLoadingVelocity,
    error: campaignsError || velocityError,
  };
}
