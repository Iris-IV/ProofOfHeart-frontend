"use client";

import { useMemo } from "react";
import type { Campaign, Milestone } from "../types";
import { calculateFundingPercentage } from "../types";
import { useCampaign } from "./useCampaign";

/**
 * Hook for accessing campaign funding-related data.
 * Handles funding goals, amounts raised, milestones, and calculations.
 */
export interface UseCampaignFundingResult {
  fundingGoal: bigint | null;
  amountRaised: bigint | null;
  fundingPercentage: number;
  deadline: number | null;
  milestones: Milestone[];
  fundsWithdrawn: boolean;
  hasRevenueSharing: boolean;
  revenueSharePercentage: number;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

export function useCampaignFunding(campaignId: number): UseCampaignFundingResult {
  const { campaign, isLoading, error, notFound } = useCampaign(campaignId);

  const funding = useMemo(() => {
    if (!campaign) {
      return {
        fundingGoal: null,
        amountRaised: null,
        fundingPercentage: 0,
        deadline: null,
        milestones: [],
        fundsWithdrawn: false,
        hasRevenueSharing: false,
        revenueSharePercentage: 0,
      };
    }

    return {
      fundingGoal: campaign.funding_goal,
      amountRaised: campaign.amount_raised,
      fundingPercentage: calculateFundingPercentage(campaign.amount_raised, campaign.funding_goal),
      deadline: campaign.deadline,
      milestones: campaign.milestones ?? [],
      fundsWithdrawn: campaign.funds_withdrawn,
      hasRevenueSharing: campaign.has_revenue_sharing,
      revenueSharePercentage: campaign.revenue_share_percentage,
    };
  }, [campaign]);

  return {
    ...funding,
    isLoading,
    error,
    notFound,
  };
}
