export interface DonationMilestone {
  id: string;
  threshold: bigint;
  label: string;
  description: string;
  badge: string;
  achieved: boolean;
  progress: number;
}

const MILESTONE_DEFINITIONS: Array<{ thresholdXlm: number; label: string; description: string; badge: string }> = [
  { thresholdXlm: 100, label: "First Spark", description: "Thank you for 100 XLM raised!", badge: "🌱" },
  { thresholdXlm: 500, label: "Momentum Builder", description: "Thank you for 500 XLM raised!", badge: "🌟" },
  { thresholdXlm: 1000, label: "Community Champion", description: "Thank you for 1,000 XLM raised!", badge: "🏆" },
  { thresholdXlm: 5000, label: "Impact Leader", description: "Thank you for 5,000 XLM raised!", badge: "💎" },
  { thresholdXlm: 10000, label: "Legendary Heart", description: "Thank you for 10,000 XLM raised!", badge: "👑" },
];

function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}

export function getMilestonesForCampaign(amountRaised: bigint): DonationMilestone[] {
  return MILESTONE_DEFINITIONS.map((def) => {
    const threshold = xlmToStroops(def.thresholdXlm);
    const achieved = amountRaised >= threshold;
    const progress = amountRaised >= threshold ? 100 : Number((amountRaised * 100n) / threshold);
    return {
      id: `milestone-${def.thresholdXlm}`,
      threshold,
      label: def.label,
      description: def.description,
      badge: def.badge,
      achieved,
      progress: Math.min(100, progress),
    };
  });
}

export function getNextMilestone(amountRaised: bigint): DonationMilestone | null {
  const milestones = getMilestonesForCampaign(amountRaised);
  return milestones.find((m) => !m.achieved) ?? null;
}

export function getAchievedMilestones(amountRaised: bigint): DonationMilestone[] {
  return getMilestonesForCampaign(amountRaised).filter((m) => m.achieved);
}
