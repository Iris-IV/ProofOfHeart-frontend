"use client";

import { getMilestonesForCampaign } from "@/lib/milestoneAchievements";

interface Props {
  amountRaised: bigint;
  compact?: boolean;
}

export default function DonationMilestones({ amountRaised, compact = false }: Props) {
  const milestones = getMilestonesForCampaign(amountRaised);
  const achieved = milestones.filter((m) => m.achieved);

  if (achieved.length === 0 && compact) return null;

  return (
    <section aria-labelledby="milestones-heading" className={compact ? "py-2" : "py-6"}>
      <h3 id="milestones-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
        <span>🏅</span> Donation Milestones
      </h3>
      <div className={compact ? "flex gap-2 flex-wrap" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
        {milestones.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl border p-3 flex items-center gap-3 ${m.achieved ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" : "bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 opacity-60"}`}
          >
            <span className="text-2xl" aria-hidden>{m.badge}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{m.label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{m.description}</p>
              {!m.achieved && (
                <div className="mt-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${m.progress}%` }} />
                </div>
              )}
            </div>
            {m.achieved && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unlocked</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
