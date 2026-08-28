"use client";

import { useMemo, useState } from "react";
import type { Campaign } from "@/types";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { useLocale } from "next-intl";
import Link from "next/link";
import { getMilestonesForCampaign } from "@/lib/milestoneAchievements";

interface CreatorDashboardProps {
  campaigns: Campaign[];
  creatorAddress: string;
}

const CAMPAIGNS_PAGE_SIZE = 10;

export default function CreatorDashboard({ campaigns, creatorAddress }: CreatorDashboardProps) {
  const locale = useLocale();
  const [visibleCount, setVisibleCount] = useState(CAMPAIGNS_PAGE_SIZE);

  const myCampaigns = useMemo(
    () => campaigns.filter((c) => c.creator === creatorAddress),
    [campaigns, creatorAddress],
  );

  const visibleCampaigns = myCampaigns.slice(0, visibleCount);
  const hasMore = visibleCount < myCampaigns.length;

  const analytics = useMemo(() => {
    const totalRaised = myCampaigns.reduce(
      (sum, c) => sum + stroopsToXlmNumber(c.amount_raised),
      0,
    );
    const totalGoal = myCampaigns.reduce((sum, c) => sum + stroopsToXlmNumber(c.funding_goal), 0);
    const active = myCampaigns.filter((c) => c.status === "active").length;
    const funded = myCampaigns.filter((c) => c.funds_withdrawn).length;
    const avgProgress = myCampaigns.length
      ? myCampaigns.reduce(
          (s, c) => s + (Number(c.amount_raised) / Number(c.funding_goal || 1n)) * 100,
          0,
        ) / myCampaigns.length
      : 0;
    return { totalRaised, totalGoal, active, funded, avgProgress, count: myCampaigns.length };
  }, [myCampaigns]);

  if (myCampaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          You have not created any causes yet.
        </p>
        <Link
          href="/causes/new"
          className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700"
        >
          Create your first cause
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Raised</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {analytics.totalRaised.toLocaleString(locale)} XLM
          </p>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Active Campaigns</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{analytics.active}</p>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Progress</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {analytics.avgProgress.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Campaigns</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{analytics.count}</p>
        </div>
      </div>

      <section aria-labelledby="manage-causes-heading">
        <div className="flex items-baseline justify-between mb-4">
          <h2 id="manage-causes-heading" className="text-lg font-semibold">
            Manage Causes
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing {visibleCampaigns.length} of {myCampaigns.length}
          </span>
        </div>
        <div className="space-y-3">
          {visibleCampaigns.map((c) => {
            const raised = stroopsToXlmNumber(c.amount_raised);
            const goal = stroopsToXlmNumber(c.funding_goal);
            const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
            const milestones = getMilestonesForCampaign(c.amount_raised);
            const next = milestones.find((m) => !m.achieved);
            return (
              <div
                key={c.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{c.title}</h3>
                    <p className="text-xs text-zinc-500">
                      {c.status} · {raised.toLocaleString(locale)} / {goal.toLocaleString(locale)}{" "}
                      XLM ({pct}%)
                    </p>
                  </div>
                  <Link
                    href={`/causes/${c.id}`}
                    className="text-sm text-blue-600 hover:underline shrink-0"
                  >
                    Manage
                  </Link>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
                {next && (
                  <p className="text-xs text-zinc-500">
                    Next milestone: {next.badge} {next.label} — {next.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + CAMPAIGNS_PAGE_SIZE)}
              className="px-6 py-2 rounded-full text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Load more
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
