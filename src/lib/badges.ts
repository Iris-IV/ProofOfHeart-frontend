/**
 * Donator badges and levels (#653).
 *
 * Pure functions over contribution history so the same rules drive the profile,
 * the leaderboard and any test — no React, no network.
 *
 * Amounts are in stroops (1 XLM = 10,000,000 stroops), matching the contract.
 */

export const STROOPS_PER_XLM = BigInt(10_000_000);

export type BadgeId = "early-backer" | "whale" | "streak" | "first-donation" | "multi-cause";

export interface Badge {
  id: BadgeId;
  label: string;
  description: string;
  icon: string;
}

export interface DonorLevel {
  level: number;
  name: string;
  icon: string;
  /** Total donated, in XLM, needed to reach this level. */
  thresholdXlm: number;
}

/** One donation, reduced to what badge rules actually need. */
export interface DonationRecord {
  campaignId: number | string;
  /** Amount in stroops. */
  amount: bigint;
  /** Unix seconds. */
  timestamp: number;
  /** Position of this donation among all donations to that campaign, 1-based. */
  backerRank?: number;
}

export const BADGES: Record<BadgeId, Badge> = {
  "first-donation": {
    id: "first-donation",
    label: "First Donation",
    description: "Made your first contribution.",
    icon: "🌱",
  },
  "early-backer": {
    id: "early-backer",
    label: "Early Backer",
    description: "Among the first 10 backers of a campaign.",
    icon: "🚀",
  },
  whale: {
    id: "whale",
    label: "Whale",
    description: "Donated 1,000 XLM or more in total.",
    icon: "🐋",
  },
  streak: {
    id: "streak",
    label: "Streak",
    description: "Donated in three or more consecutive months.",
    icon: "🔥",
  },
  "multi-cause": {
    id: "multi-cause",
    label: "Multi-Cause",
    description: "Supported five or more different campaigns.",
    icon: "🌍",
  },
};

export const DONOR_LEVELS: DonorLevel[] = [
  { level: 0, name: "Newcomer", icon: "○", thresholdXlm: 0 },
  { level: 1, name: "Supporter", icon: "◔", thresholdXlm: 10 },
  { level: 2, name: "Advocate", icon: "◑", thresholdXlm: 100 },
  { level: 3, name: "Champion", icon: "◕", thresholdXlm: 500 },
  { level: 4, name: "Guardian", icon: "●", thresholdXlm: 1_000 },
  { level: 5, name: "Legend", icon: "★", thresholdXlm: 5_000 },
];

export const EARLY_BACKER_RANK = 10;
export const WHALE_THRESHOLD_XLM = 1_000;
export const STREAK_MONTHS = 3;
export const MULTI_CAUSE_CAMPAIGNS = 5;

export function stroopsToXlmNumber(stroops: bigint): number {
  return Number(stroops) / Number(STROOPS_PER_XLM);
}

export function totalDonatedStroops(donations: DonationRecord[]): bigint {
  return donations.reduce((sum, d) => sum + d.amount, BigInt(0));
}

/** `YYYY-MM` in UTC, so streaks do not shift with the viewer's timezone. */
function monthKey(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Longest run of consecutive calendar months containing at least one donation.
 * A month with several donations counts once; a gap resets the run.
 */
export function longestMonthlyStreak(donations: DonationRecord[]): number {
  if (donations.length === 0) return 0;

  const months = [...new Set(donations.map((d) => monthKey(d.timestamp)))].sort();

  let longest = 1;
  let current = 1;

  for (let i = 1; i < months.length; i++) {
    const [prevYear, prevMonth] = months[i - 1].split("-").map(Number);
    const [year, month] = months[i].split("-").map(Number);
    const monthsApart = (year - prevYear) * 12 + (month - prevMonth);

    current = monthsApart === 1 ? current + 1 : 1;
    if (current > longest) longest = current;
  }

  return longest;
}

export function earnedBadges(donations: DonationRecord[]): Badge[] {
  if (donations.length === 0) return [];

  const earned: BadgeId[] = ["first-donation"];

  if (
    donations.some((d) => typeof d.backerRank === "number" && d.backerRank <= EARLY_BACKER_RANK)
  ) {
    earned.push("early-backer");
  }

  if (stroopsToXlmNumber(totalDonatedStroops(donations)) >= WHALE_THRESHOLD_XLM) {
    earned.push("whale");
  }

  if (longestMonthlyStreak(donations) >= STREAK_MONTHS) {
    earned.push("streak");
  }

  if (new Set(donations.map((d) => String(d.campaignId))).size >= MULTI_CAUSE_CAMPAIGNS) {
    earned.push("multi-cause");
  }

  return earned.map((id) => BADGES[id]);
}

export interface DonorProgress {
  current: DonorLevel;
  next: DonorLevel | null;
  totalXlm: number;
  /** 0-100 progress toward `next`; 100 when already at the top level. */
  progressPercent: number;
  xlmToNextLevel: number;
}

export function donorProgress(donations: DonationRecord[]): DonorProgress {
  const totalXlm = stroopsToXlmNumber(totalDonatedStroops(donations));

  let current = DONOR_LEVELS[0];
  for (const level of DONOR_LEVELS) {
    if (totalXlm >= level.thresholdXlm) current = level;
  }

  const next = DONOR_LEVELS[current.level + 1] ?? null;
  if (!next) {
    return { current, next: null, totalXlm, progressPercent: 100, xlmToNextLevel: 0 };
  }

  const span = next.thresholdXlm - current.thresholdXlm;
  const gained = totalXlm - current.thresholdXlm;

  return {
    current,
    next,
    totalXlm,
    progressPercent: Math.max(0, Math.min(100, Math.round((gained / span) * 100))),
    xlmToNextLevel: Math.max(0, next.thresholdXlm - totalXlm),
  };
}
