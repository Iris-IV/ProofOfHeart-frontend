export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface UserGamificationProfile {
  level: string;
  levelNumber: number;
  totalDonated: number;
  donationCount: number;
  nextLevelThreshold: number;
  progressPercent: number;
  badges: Badge[];
}

export const LEVEL_THRESHOLDS = [
  { level: 'Bronze', levelNumber: 1, min: 0, max: 100 },
  { level: 'Silver', levelNumber: 2, min: 100, max: 500 },
  { level: 'Gold', levelNumber: 3, min: 500, max: 2000 },
  { level: 'Platinum', levelNumber: 4, min: 2000, max: 5000 },
  { level: 'Diamond', levelNumber: 5, min: 5000, max: Infinity },
];

export function calculateGamificationProfile(
  totalDonated: number,
  donationCount: number = 0,
  isEarlyBacker: boolean = false
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
  const progressPercent = currentLevelRange === Infinity 
    ? 100 
    : Math.min(100, Math.round((progressAmount / currentLevelRange) * 100));

  const badges: Badge[] = [
    {
      id: 'early_backer',
      name: 'Early Backer',
      description: 'Supported ProofOfHeart in its early days',
      icon: '🌱',
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
      unlocked: isEarlyBacker || donationCount > 0,
    },
    {
      id: 'streak_master',
      name: 'Streak Master',
      description: 'Made 3 or more donations',
      icon: '🔥',
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
      unlocked: donationCount >= 3,
    },
    {
      id: 'whale',
      name: 'Whale',
      description: 'Donated 1,000 XLM or more in total',
      icon: '🐋',
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
      unlocked: totalDonated >= 1000,
    },
    {
      id: 'heart_champion',
      name: 'Heart Champion',
      description: 'Reached Diamond level (5,000+ XLM donated)',
      icon: '💎',
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
      unlocked: totalDonated >= 5000,
    },
  ];

  return {
    level: currentLevel.level,
    levelNumber: currentLevel.levelNumber,
    totalDonated,
    donationCount,
    nextLevelThreshold,
    progressPercent,
    badges,
  };
}
