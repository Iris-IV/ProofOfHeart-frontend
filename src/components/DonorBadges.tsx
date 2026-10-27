"use client";

import { useMemo } from "react";
import { donorProgress, earnedBadges, type DonationRecord } from "@/lib/badges";

interface DonorBadgesProps {
  donations: DonationRecord[];
}

/**
 * Donor level and earned badges for the profile. Badges fade and zoom in with a
 * short stagger. Motion is limited to `motion-safe` and the progress bar's
 * transition is removed for `motion-reduce`.
 */
export default function DonorBadges({ donations }: DonorBadgesProps) {
  const badges = useMemo(() => earnedBadges(donations), [donations]);
  const progress = useMemo(() => donorProgress(donations), [donations]);

  return (
    <section aria-labelledby="donor-badges-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="donor-badges-heading" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Donor badges
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          <span aria-hidden="true">{progress.current.icon}</span> {progress.current.name}
          {" · "}
          {progress.totalXlm.toLocaleString()} XLM donated
        </p>
      </div>

      {progress.next && (
        <div className="space-y-1">
          <div
            role="progressbar"
            aria-label={`Progress to ${progress.next.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.progressPercent}
            className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-700"
          >
            <div
              className="h-2 rounded-full bg-linear-to-r from-red-500 to-pink-500 transition-[width] duration-150 ease-out motion-reduce:transition-none"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {progress.xlmToNextLevel.toLocaleString()} XLM to {progress.next.name}
          </p>
        </div>
      )}

      {badges.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Make your first donation to earn a badge.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {badges.map((badge, index) => (
            <li
              key={badge.id}
              title={badge.description}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-150 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
