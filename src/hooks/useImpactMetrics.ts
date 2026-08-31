"use client";

import { useMemo } from "react";
import { Category, type Campaign } from "../types";
import { stroopsToXlmNumber } from "../lib/stellarAmount";

export interface ImpactMetrics {
  estimatedLivesImpacted: number;
  communityReach: number;
  fundingEfficiency: number;
  donorCount: number;
  socialAmplification: number;
}

const CATEGORY_IMPACT_MULTIPLIER: Record<Category, number> = {
  [Category.Learner]: 3,
  [Category.EducationalStartup]: 8,
  [Category.Educator]: 5,
  [Category.Publisher]: 4,
};

const BASE_LIVES_PER_XLM = 0.5;
const REACH_PER_XLM = 2.5;
const SOCIAL_MULTIPLIER = 1.5;

export function calculateImpactMetrics(campaign: Campaign): ImpactMetrics {
  const raisedXlm = stroopsToXlmNumber(campaign.amount_raised);
  const goalXlm = stroopsToXlmNumber(campaign.funding_goal);
  const fundingPct = goalXlm > 0 ? Math.min(1, raisedXlm / goalXlm) : 0;
  const multiplier = CATEGORY_IMPACT_MULTIPLIER[campaign.category] ?? 3;

  const estimatedLivesImpacted = Math.round(
    raisedXlm * BASE_LIVES_PER_XLM * multiplier * fundingPct,
  );
  const communityReach = Math.round(
    raisedXlm * REACH_PER_XLM * multiplier * fundingPct,
  );
  const fundingEfficiency = fundingPct * 100;
  const donorCount = Math.max(1, Math.round(raisedXlm / 10));
  const socialAmplification = Math.round(estimatedLivesImpacted * SOCIAL_MULTIPLIER);

  return {
    estimatedLivesImpacted,
    communityReach,
    fundingEfficiency,
    donorCount,
    socialAmplification,
  };
}

export function useImpactMetrics(campaign: Campaign | null): ImpactMetrics | null {
  return useMemo(() => {
    if (!campaign) return null;
    return calculateImpactMetrics(campaign);
  }, [campaign]);
}
