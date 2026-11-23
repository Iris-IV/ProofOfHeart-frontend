"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { BarChart3, Loader2 } from "lucide-react";
import { getCampaignStats } from "@/lib/contractClient";
import type { ContractCampaignStats } from "@/lib/contractClient";
import { formatAmount, formatDate } from "@/lib/formatters";
import { formatAddress } from "@/lib/formatAddress";
import { parseContractError } from "@/utils/contractErrors";

interface CampaignStatsPanelProps {
  campaignId: number;
}

/** Contract-sourced stats for /causes/[id] (issue #1777). */
export default function CampaignStatsPanel({ campaignId }: CampaignStatsPanelProps) {
  const t = useTranslations("CampaignStats");
  const tContractErrors = useTranslations("ContractErrors");
  const locale = useLocale();

  const { data, isLoading, isError, error, refetch } = useQuery<ContractCampaignStats, Error>({
    queryKey: ["campaignStats", campaignId],
    queryFn: () => getCampaignStats(campaignId),
    staleTime: 30_000,
  });

  const errorMessage = (() => {
    if (!isError) return "";
    const message = parseContractError(error);
    return message.startsWith("ContractErrors.")
      ? tContractErrors(message.replace("ContractErrors.", ""))
      : t("loadError");
  })();

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
      aria-labelledby={`campaign-stats-title-${campaignId}`}
    >
      <h2
        id={`campaign-stats-title-${campaignId}`}
        className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
      >
        <BarChart3 size={16} aria-hidden="true" />
        {t("title")}
      </h2>

      {isLoading && (
        <p className="flex items-center gap-2 text-sm text-zinc-500" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("loading")}
        </p>
      )}

      {isError && (
        <div className="text-sm text-red-600 dark:text-red-400" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 font-semibold underline"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {data && (
        <dl className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <div className="flex justify-between gap-3">
            <dt>{t("contributors")}</dt>
            <dd className="font-semibold text-zinc-900 dark:text-zinc-50">
              {data.contributorCount}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("topContributor")}</dt>
            <dd className="font-mono">
              {data.topContributor ? formatAddress(data.topContributor) : t("none")}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("avgContribution")}</dt>
            <dd>
              {data.contributorCount > 0
                ? `${formatAmount(data.avgContribution, locale)} XLM`
                : t("none")}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>{t("lastContribution")}</dt>
            <dd>
              {data.lastContributionTime > 0
                ? formatDate(data.lastContributionTime, locale)
                : t("none")}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
