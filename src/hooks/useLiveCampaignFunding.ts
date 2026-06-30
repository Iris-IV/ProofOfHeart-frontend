"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCampaign } from "./useCampaign";
import { useCampaignContributionEvents } from "./useCampaignContributionEvents";
import type { Campaign } from "../types";

export interface UseLiveCampaignFundingResult {
  campaign: Campaign | null;
  amountRaised: bigint;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Campaign detail funding with live increments from `contribution_made` events
 * and periodic reconciliation via `get_campaign`.
 */
export function useLiveCampaignFunding(campaignId: number): UseLiveCampaignFundingResult {
  const { campaign, isLoading, error, refetch } = useCampaign(campaignId);
  const [liveAmountRaised, setLiveAmountRaised] = useState<bigint | null>(null);

  useEffect(() => {
    if (campaign) {
      setLiveAmountRaised(campaign.amount_raised);
    } else {
      setLiveAmountRaised(null);
    }
  }, [campaign]);

  const handleContributions = useCallback((delta: bigint) => {
    setLiveAmountRaised((current) => (current ?? BigInt(0)) + delta);
  }, []);

  useCampaignContributionEvents({
    campaignId,
    enabled: Boolean(campaign),
    onContributions: handleContributions,
  });

  const displayCampaign = useMemo(() => {
    if (!campaign) return null;
    if (liveAmountRaised === null) return campaign;
    return { ...campaign, amount_raised: liveAmountRaised };
  }, [campaign, liveAmountRaised]);

  return {
    campaign: displayCampaign,
    amountRaised: liveAmountRaised ?? campaign?.amount_raised ?? BigInt(0),
    isLoading,
    error,
    refetch,
  };
}
