import { formatAddress } from "./formatAddress";
import { normalizeAddress } from "./stellar";
import { getArray, setArray } from "./localStorageStore";

export interface ContributorLeaderboardItem {
  walletAddress: string;
  truncatedAddress: string;
  totalAmountStroops: bigint;
  isAnonymous: boolean;
  rank: number;
}

const ANON_PREFERENCE_KEY = "proof_of_heart_anon_preference_v1";

/**
 * Check if a specific wallet has opted out of appearing publicly on leaderboards.
 * Opt-out / Anonymity consideration:
 * - Addresses registered in anon_preference storage will display as "Anonymous Supporter"
 * - Wallet addresses are masked and not exposed in public lists when opted out.
 */
export function isWalletAnonymous(walletAddress: string): boolean {
  const anonWallets = getArray<string>(ANON_PREFERENCE_KEY);
  return anonWallets.includes(normalizeAddress(walletAddress));
}

/**
 * Toggle or set the anonymity / opt-out setting for a connected wallet.
 */
export function setWalletAnonymous(walletAddress: string, isAnon: boolean): void {
  const normalized = normalizeAddress(walletAddress);
  const anonWallets = getArray<string>(ANON_PREFERENCE_KEY);

  if (isAnon) {
    if (!anonWallets.includes(normalized)) {
      anonWallets.push(normalized);
    }
  } else {
    const filtered = anonWallets.filter((w) => w !== normalized);
    setArray(ANON_PREFERENCE_KEY, filtered);
    return;
  }

  setArray(ANON_PREFERENCE_KEY, anonWallets);
}

// Initial demo seed data for top supporters per campaign ID
const INITIAL_DEMO_CONTRIBUTORS: Record<
  number,
  { walletAddress: string; amountStroops: bigint; isAnon?: boolean }[]
> = {
  1: [
    {
      walletAddress: "GDA7X7P5H4F3R8E2M1N6K9W4L5V8Q3Z0A1B2C3D4E5F6G7H8I9J0K1L2",
      amountStroops: BigInt(250_000_000_000),
    },
    {
      walletAddress: "GBX8Y8Q6I5G4S9F3N2O7L0X5M6W9R4A1B2C3D4E5F6G7H8I9J0K1L2M3",
      amountStroops: BigInt(180_000_000_000),
    },
    {
      walletAddress: "GCZ9Z9R7J6H5T0G4O3P8M1Y6N7X0S5B2C3D4E5F6G7H8I9J0K1L2M3N4",
      amountStroops: BigInt(120_000_000_000),
    },
    {
      walletAddress: "GDK1A0S8K7I6U1H5P4Q9N2Z7O8Y1T6C3D4E5F6G7H8I9J0K1L2M3N4O5",
      amountStroops: BigInt(50_000_000_000),
      isAnon: true,
    },
  ],
  2: [
    {
      walletAddress: "GEL2B1T9L8J7V2I6Q5R0O3A8P9Z2U7D4E5F6G7H8I9J0K1L2M3N4O5P6",
      amountStroops: BigInt(50_000_000_000),
    },
    {
      walletAddress: "GFM3C2U0M9K8W3J7R6S1P4B9Q0A3V8E5F6G7H8I9J0K1L2M3N4O5P6Q7",
      amountStroops: BigInt(30_000_000_000),
    },
  ],
  3: [
    {
      walletAddress: "GGN4D3V1N0L9X4K8S7T2Q5C0R1B4W9F6G7H8I9J0K1L2M3N4O5P6Q7R8",
      amountStroops: BigInt(450_000_000_000),
    },
    {
      walletAddress: "GHO5E4W2O1M0Y5L9T8U3R6D1S2C5X0G7H8I9J0K1L2M3N4O5P6Q7R8S9",
      amountStroops: BigInt(220_000_000_000),
    },
    {
      walletAddress: "GIP6F5X3P2N1Z6M0U9V4S7E2T3D6Y1H8I9J0K1L2M3N4O5P6Q7R8S9T0",
      amountStroops: BigInt(110_000_000_000),
    },
  ],
};

/**
 * Aggregate contribution records per wallet address for a specific campaign.
 */
export function aggregateCampaignContributors(
  campaignId: number,
  localTransactions: {
    walletAddress: string;
    campaignId: number;
    action: string;
    amount?: bigint;
  }[] = [],
  limit = 5,
): ContributorLeaderboardItem[] {
  const totalsMap = new Map<string, bigint>();
  const anonOverrideMap = new Map<string, boolean>();

  // Load seed demo contributors if available
  const demoEntries = INITIAL_DEMO_CONTRIBUTORS[campaignId] ?? [];
  for (const entry of demoEntries) {
    const normalized = normalizeAddress(entry.walletAddress);
    totalsMap.set(normalized, entry.amountStroops);
    if (entry.isAnon) {
      anonOverrideMap.set(normalized, true);
    }
  }

  // Aggregate local transactions for this campaign
  for (const tx of localTransactions) {
    if (tx.campaignId === campaignId && tx.action === "contribute") {
      const normalized = normalizeAddress(tx.walletAddress);
      const current = totalsMap.get(normalized) ?? BigInt(0);
      const addAmount = tx.amount ?? BigInt(10_000_000); // 1 XLM fallback if unprovided
      totalsMap.set(normalized, current + addAmount);
    }
  }

  const items: Omit<ContributorLeaderboardItem, "rank">[] = [];
  totalsMap.forEach((totalAmountStroops, walletAddress) => {
    if (totalAmountStroops > BigInt(0)) {
      const isAnon =
        isWalletAnonymous(walletAddress) || anonOverrideMap.get(walletAddress) === true;
      items.push({
        walletAddress,
        truncatedAddress: isAnon ? "Anonymous Supporter" : formatAddress(walletAddress),
        totalAmountStroops,
        isAnonymous: isAnon,
      });
    }
  });

  // Sort descending by contribution amount
  items.sort((a, b) =>
    b.totalAmountStroops > a.totalAmountStroops
      ? 1
      : b.totalAmountStroops < a.totalAmountStroops
        ? -1
        : 0,
  );

  return items.slice(0, limit).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}
