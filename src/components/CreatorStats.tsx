"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { Skeleton } from "@/components/Skeleton";
import { useCreatorStats } from "@/hooks/useCreatorStats";
import { formatAmount } from "@/lib/formatters";

interface CreatorStatsProps {
  address: string;
}

export default function CreatorStats({ address }: CreatorStatsProps) {
  const t = useTranslations("Profile");
  const tContractErrors = useTranslations("ContractErrors");
  const locale = useLocale();
  const { stats, isLoading, error, refetch } = useCreatorStats(address);
  const localizedError = error?.startsWith("ContractErrors.") ? tContractErrors(error) : error;

  if (isLoading) {
    return (
      <div className="mt-8 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-8 dark:border-zinc-700 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40"
      >
        <p className="text-sm text-red-700 dark:text-red-300">{localizedError}</p>
        <Button variant="secondary" onClick={refetch}>
          {t("creatorStatsRetry")}
        </Button>
      </div>
    );
  }

  if (!stats?.isKnownCreator) {
    return (
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
        <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <AlertTriangle size={16} aria-hidden="true" />
          {t("creatorUnknown")}
        </p>
      </div>
    );
  }

  const tiles = [
    { label: t("creatorTotalCampaigns"), value: String(stats.totalCampaigns) },
    { label: t("creatorActiveCampaigns"), value: String(stats.activeCampaigns) },
    {
      label: t("creatorTotalRaised"),
      value: `${formatAmount(stats.totalRaised, locale, { maximumFractionDigits: 2 })} XLM`,
    },
    { label: t("creatorTotalContributors"), value: String(stats.totalContributors) },
  ];

  return (
    <section
      aria-label={t("creatorStatsTitle")}
      className="mt-8 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-8 dark:border-zinc-700 sm:grid-cols-4"
    >
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {tile.label}
          </p>
          <p className="mt-1 break-words text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {tile.value}
          </p>
        </div>
      ))}
    </section>
  );
}
