/**
 * Donor levels and badges.
 *
 * Pure functions: the level and the badges are recomputed from the inputs on
 * every call and nothing is stored. Amounts are plain numbers of **XLM**, not
 * stroops; convert contract amounts first (`Number(stroops) / 10_000_000`).
 *
 * Rules, worked examples and how to change them: `docs/GAMIFICATION.md`.
 *
 * @example
 * const profile = calculateGamificationProfile(750, 3);
 * // profile.levelId === "Gold", profile.progressPercent === 17
 * // unlocked badges: early_backer, streak_master
 */

/**
 * A badge in a donor's profile. `name` and `description` are translation keys in
 * the `Gamification` namespace of `messages/*.json`, not display text.
 * `unlockedAt` is never set by this module.
 */
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  unlockedAt?: string;
}

/** The result of {@link calculateGamificationProfile}. */
export interface UserGamificationProfile {
  levelId: string;
  levelNumber: number;
  totalDonated: number;
  donationCount: number;
  nextLevelThreshold: number;
  progressPercent: number;
  badges: Badge[];
}

/**
 * Level tiers in ascending order. A donor is in the highest tier whose `min`
 * (inclusive, in XLM) they have reached; each `max` equals the next tier's `min`.
 */
export const LEVEL_THRESHOLDS = [
  { levelId: "Bronze", levelNumber: 1, min: 0, max: 100 },
  { levelId: "Silver", levelNumber: 2, min: 100, max: 500 },
  { levelId: "Gold", levelNumber: 3, min: 500, max: 2000 },
  { levelId: "Platinum", levelNumber: 4, min: 2000, max: 5000 },
  { levelId: "Diamond", levelNumber: 5, min: 5000, max: Infinity },
];

/**
 * Work out a donor's level, progress towards the next level and badges.
 *
 * - Level: highest tier reached by `totalDonated`; zero and negative totals stay Bronze.
 * - `progressPercent`: 0 to 100, rounded; always 100 at Diamond. `nextLevelThreshold`
 *   is `Infinity` at Diamond.
 * - Badges, always in this order: `early_backer` (`isEarlyBacker` or at least one
 *   donation), `streak_master` (3 or more donations), `whale` (1,000 XLM or more),
 *   `heart_champion` (5,000 XLM or more).
 *
 * @param totalDonated Total donated, in XLM.
 * @param donationCount Number of donations. Defaults to 0.
 * @param isEarlyBacker Whether the donor is a known early backer. Defaults to false.
 */
export function calculateGamificationProfile(
  totalDonated: number,
  donationCount: number = 0,
  isEarlyBacker: boolean = false,
): UserGamificationProfile {
  let currentLevel = LEVEL_THRESHOLDS[0];

  for (const tier of LEVEL_THRESHOLDS) {
    if (totalDonated >= tier.min) {
      currentLevel = tier;
    }
  }

  const nextLevel = LEVEL_THRESHOLDS.find((t) => t.levelNumber === currentLevel.levelNumber + 1);
  const nextLevelThreshold = nextLevel ? nextLevel.min : currentLevel.max;

  const currentLevelRange = (nextLevel ? nextLevel.min : currentLevel.max) - currentLevel.min;
  const progressAmount = Math.max(0, totalDonated - currentLevel.min);
  const progressPercent =
    currentLevelRange === Infinity
      ? 100
      : Math.min(100, Math.round((progressAmount / currentLevelRange) * 100));

  const badges: Badge[] = [
    {
      id: "early_backer",
      name: "badge_early_backer_name",
      description: "badge_early_backer_desc",
      icon: "🌱",
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
      unlocked: isEarlyBacker || donationCount > 0,
    },
    {
      id: "streak_master",
      name: "badge_streak_master_name",
      description: "badge_streak_master_desc",
      icon: "🔥",
      color: "bg-amber-500/10 text-amber-500 border-amber-500/30",
      unlocked: donationCount >= 3,
    },
    {
      id: "whale",
      name: "badge_whale_name",
      description: "badge_whale_desc",
      icon: "🐋",
      color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      unlocked: totalDonated >= 1000,
    },
    {
      id: "heart_champion",
      name: "badge_heart_champion_name",
      description: "badge_heart_champion_desc",
      icon: "💎",
      color: "bg-purple-500/10 text-purple-500 border-purple-500/30",
      unlocked: totalDonated >= 5000,
    },
  ];

  return {
    levelId: currentLevel.levelId,
    levelNumber: currentLevel.levelNumber,
    totalDonated,
    donationCount,
    nextLevelThreshold,
    progressPercent,
    badges,
  };
}
