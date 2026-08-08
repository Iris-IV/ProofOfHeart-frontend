"use client";

import { memo, useMemo } from "react";
import { DonationRecord, donorProgress, earnedBadges } from "../lib/badges";

interface DonorBadgesProps {
  donations: DonationRecord[];
  /** `full` shows the level bar and badge list; `compact` is for leaderboards. */
  variant?: "full" | "compact";
}

/**
 * Donator badges and level, shown on a profile or beside a leaderboard row (#653).
 */
function DonorBadges({ donations, variant = "full" }: DonorBadgesProps) {
  const badges = useMemo(() => earnedBadges(donations), [donations]);
  const progress = useMemo(() => donorProgress(donations), [donations]);

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-1" data-testid="donor-badges-compact">
        <span
          className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
          title={`Level ${progress.current.level} · ${progress.current.name}`}
        >
          {progress.current.icon} {progress.current.name}
        </span>
        {badges.map((badge) => (
          <span
            key={badge.id}
            title={`${badge.label}: ${badge.description}`}
            aria-label={badge.label}
          >
            {badge.icon}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div
      data-testid="donor-badges"
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Donor level</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {progress.totalXlm.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM donated
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {progress.current.icon} {progress.current.name}
          </span>
          {progress.next ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {progress.xlmToNextLevel.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
              to {progress.next.name}
            </span>
          ) : (
            <span className="text-xs text-amber-600 dark:text-amber-400">Top level reached</span>
          )}
        </div>
        <div
          className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2"
          role="progressbar"
          aria-valuenow={progress.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress to ${progress.next?.name ?? "top level"}`}
        >
          <div
            className="bg-linear-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress.progressPercent}%` }}
          />
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
          Badges
        </h4>
        {badges.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Make your first donation to start earning badges.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <li
                key={badge.id}
                title={badge.description}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700/50 px-3 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200"
              >
                <span aria-hidden="true">{badge.icon}</span>
                {badge.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default memo(DonorBadges);
