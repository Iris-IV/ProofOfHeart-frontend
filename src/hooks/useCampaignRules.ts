"use client";

import { useMemo } from "react";
import type { CampaignStatus } from "../types";
import { useCampaign } from "./useCampaign";

/**
 * Hook for accessing campaign rules and state flags.
 * Handles status, verification, and lifecycle rules.
 */
export interface UseCampaignRulesResult {
  status: CampaignStatus | null;
  isActive: boolean;
  isCancelled: boolean;
  isVerified: boolean;
  canContribute: boolean;
  canWithdraw: boolean;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

export function useCampaignRules(campaignId: number): UseCampaignRulesResult {
  const { campaign, isLoading, error, notFound } = useCampaign(campaignId);

  const rules = useMemo(() => {
    if (!campaign) {
      return {
        status: null,
        isActive: false,
        isCancelled: false,
        isVerified: false,
        canContribute: false,
        canWithdraw: false,
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const deadlinePassed = campaign.deadline < now;
    const fundingGoalReached = campaign.amount_raised >= campaign.funding_goal;

    return {
      status: campaign.status,
      isActive: campaign.is_active,
      isCancelled: campaign.is_cancelled,
      isVerified: campaign.is_verified,
      canContribute: campaign.is_active && !deadlinePassed && !fundingGoalReached,
      canWithdraw:
        deadlinePassed && fundingGoalReached && !campaign.funds_withdrawn && campaign.is_active,
    };
  }, [campaign]);

  return {
    ...rules,
    isLoading,
    error,
    notFound,
  };
}
