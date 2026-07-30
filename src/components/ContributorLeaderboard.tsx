"use client";

import { useState } from "react";
import { Award, EyeOff, ShieldCheck } from "lucide-react";
import Amount from "./Amount";
import { useTopContributors } from "@/hooks/useTopContributors";
import { isWalletAnonymous, setWalletAnonymous } from "@/lib/contributorLeaderboard";
import { normalizeAddress } from "@/lib/stellar";
import { calculateGamificationProfile } from "@/lib/gamification";
import { useTranslations } from "next-intl";

interface ContributorLeaderboardProps {
  campaignId: number;
  userWalletAddress: string | null;
  limit?: number;
}

export default function ContributorLeaderboard({
  campaignId,
  userWalletAddress,
  limit = 5,
}: ContributorLeaderboardProps) {
  const { contributors, isLoading, refetch } = useTopContributors(
    campaignId,
    userWalletAddress,
    limit,
  );
  const t = useTranslations("ContributorLeaderboard");
  const tGamification = useTranslations("Gamification");
  const [isAnon, setIsAnon] = useState(() =>
    userWalletAddress ? isWalletAnonymous(userWalletAddress) : false,
  );

  const handleToggleAnonymity = () => {
    if (!userWalletAddress) return;
    const nextAnonState = !isAnon;
    setWalletAnonymous(userWalletAddress, nextAnonState);
    setIsAnon(nextAnonState);
    refetch();
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `#${rank}`;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("title")}</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 bg-zinc-100 dark:bg-zinc-700/50 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  const isUserConnected = !!userWalletAddress;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("title")}</h2>
        </div>
        <span className="text-xs font-medium text-zinc-400">{t("subtitle")}</span>
      </div>

      {contributors.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("emptyMessage")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5" aria-label="Top supporters list">
          {contributors.map((item) => {
            const isSelf =
              isUserConnected &&
              normalizeAddress(item.walletAddress) === normalizeAddress(userWalletAddress);

            return (
              <li
                key={item.walletAddress}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                  isSelf
                    ? "bg-blue-50/70 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    : "bg-zinc-50 dark:bg-zinc-700/40 border-zinc-100 dark:border-zinc-700/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 text-center font-bold text-sm select-none">
                    {getRankBadge(item.rank)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1.5">
                      <span>{item.truncatedAddress}</span>
                      {(() => {
                        const amountXlm = item.totalAmountStroops ? Number(item.totalAmountStroops) / 10_000_000 : 0;
                        const profile = calculateGamificationProfile(amountXlm);
                        return (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-sans font-medium border border-rose-500/20">
                            {tGamification(`level_${profile.levelId}`)}
                          </span>
                        );
                      })()}
                      {isSelf && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-[10px] font-sans font-semibold">
                          {t("youBadge")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">
                  <Amount value={item.totalAmountStroops} maximumFractionDigits={2} /> XLM
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Anonymity / Opt-Out Section */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-700/60 space-y-2">
        {isUserConnected && (
          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
              <span>{t("hideWallet")}</span>
            </span>
            <button
              type="button"
              onClick={handleToggleAnonymity}
              className={`px-2.5 py-1 rounded-full font-medium text-xs transition-colors border ${
                isAnon
                  ? "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700"
                  : "bg-white text-zinc-600 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-600 hover:border-purple-400"
              }`}
              aria-label={isAnon ? t("disableAnon") : t("enableAnon")}
            >
              {isAnon ? t("anonymousState") : t("optOutState")}
            </button>
          </div>
        )}

        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight flex items-start gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
          <span>
            {t("optOutTooltip")}
          </span>
        </p>
      </div>
    </div>
  );
}
