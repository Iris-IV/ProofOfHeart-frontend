"use client";

import { Campaign, Milestone } from "@/types";
import { formatXlm, stroopsToXlmNumber } from "@/lib/formatters";
import { useTranslations, useLocale } from "next-intl";

interface ImpactReportProps {
  campaign: Campaign;
}

function getCompletedMilestones(campaign: Campaign): Milestone[] {
  if (!campaign.milestones || campaign.milestones.length === 0) return [];
  const raised = campaign.amount_raised;
  return campaign.milestones.filter((m) => m.targetAmount <= raised);
}

export default function ImpactReport({ campaign }: ImpactReportProps) {
  const t = useTranslations("ImpactReport");
  const locale = useLocale();

  const completedMilestones = getCompletedMilestones(campaign);
  const raisedXlm = stroopsToXlmNumber(campaign.amount_raised);

  const stats = [
    {
      label: t("totalRaised"),
      value: formatXlm(raisedXlm, locale),
      cls: "text-blue-600 dark:text-blue-400",
    },
    {
      label: t("milestonesCompleted"),
      value: String(completedMilestones.length),
      cls: "text-green-600 dark:text-green-400",
    },
  ];

  if (completedMilestones.length === 0) {
    return (
      <section className="space-y-6" aria-labelledby="impact-heading">
        <h2 id="impact-heading" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("title")}
        </h2>
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-8 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t("noMilestones")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="impact-heading">
      <h2 id="impact-heading" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, cls }) => (
          <div
            key={label}
            className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 text-center"
          >
            <div className={`text-2xl sm:text-3xl font-bold ${cls}`}>{value}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {completedMilestones.length > 0 && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
            {t("completedMilestones")}
          </h3>
          <div className="space-y-4">
            {completedMilestones.map((milestone) => (
              <div
                key={milestone.description}
                className="flex items-start gap-4 p-4 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg"
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {milestone.description}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {t("milestoneTarget", {
                      amount: formatXlm(stroopsToXlmNumber(milestone.targetAmount), locale),
                    })}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  {t("milestoneReached")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
