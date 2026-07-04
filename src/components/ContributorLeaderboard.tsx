"use client";

import { useCampaignContributors } from "@/hooks/useCampaignContributors";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { formatXlm } from "@/lib/formatters";
import { useLocale } from "next-intl";

interface ContributorLeaderboardProps {
  campaignId: number;
}

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ContributorLeaderboard({ campaignId }: ContributorLeaderboardProps) {
  const { topContributors, isLoading, error } = useCampaignContributors(campaignId, 5);
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Top Supporters
        </h2>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between items-center animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-full"></div>
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-24"></div>
              </div>
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || topContributors.length === 0) {
    return null; // Hide if no contributors or error
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Top Supporters</h2>
      <ul className="space-y-4 mb-4">
        {topContributors.map((contributor, index) => {
          const xlmAmount = stroopsToXlmNumber(contributor.totalAmount);
          return (
            <li key={contributor.address} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800">
                  {index + 1}
                </div>
                <span
                  className="text-sm font-mono text-zinc-700 dark:text-zinc-300"
                  title={contributor.address}
                >
                  {truncateAddress(contributor.address)}
                </span>
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {formatXlm(xlmAmount, locale)} XLM
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-4 border-t border-zinc-100 dark:border-zinc-700 pt-4">
        Contributions are recorded publicly on the Stellar ledger. If you prefer to remain
        anonymous, please use a fresh or unlinked wallet when donating.
      </p>
    </div>
  );
}
