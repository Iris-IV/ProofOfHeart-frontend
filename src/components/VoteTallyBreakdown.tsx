"use client";

import { useTranslations } from "next-intl";
import { getVoteBreakdown } from "@/hooks/useLiveVoteTallies";

interface VoteTallyBreakdownProps {
  upvotes: number;
  downvotes: number;
  /** Show the "Live" pulse when tallies stream from contract events. */
  live?: boolean;
  className?: string;
}

/**
 * Segmented Approve vs Reject bar with percentage badges (#1354).
 *
 * The two segments share one track and animate their widths in 120ms when a
 * vote lands, so a live tally update reads as a nudge rather than a jump. With
 * no votes the track stays neutral instead of pretending to be a 50/50 split.
 */
export default function VoteTallyBreakdown({
  upvotes,
  downvotes,
  live = false,
  className = "",
}: VoteTallyBreakdownProps) {
  const t = useTranslations("Voting");
  const { approvePct, rejectPct, hasVotes, leading } = getVoteBreakdown({ upvotes, downvotes });
  const summary = hasVotes
    ? t("approveRejectPercent", { approve: approvePct, reject: rejectPct })
    : t("noVotesYet");

  return (
    <div className={`w-full space-y-2 ${className}`} data-leading={leading}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span
          data-testid="approve-badge"
          className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500/15 to-green-500/15 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-500/30 transition-transform duration-(--duration-snappy) dark:text-emerald-300 ${
            leading === "approve" ? "motion-safe:scale-105" : ""
          }`}
        >
          <span aria-hidden="true">✓</span>
          <span className="tabular-nums">{hasVotes ? `${approvePct}%` : "—"}</span>
          <span className="sr-only">{t("approve")}</span>
        </span>

        {live && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t("liveTally")}
          </span>
        )}

        <span
          data-testid="reject-badge"
          className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500/15 to-red-500/15 px-2.5 py-1 text-rose-700 ring-1 ring-rose-500/30 transition-transform duration-(--duration-snappy) dark:text-rose-300 ${
            leading === "reject" ? "motion-safe:scale-105" : ""
          }`}
        >
          <span className="tabular-nums">{hasVotes ? `${rejectPct}%` : "—"}</span>
          <span aria-hidden="true">✕</span>
          <span className="sr-only">{t("reject")}</span>
        </span>
      </div>

      <div
        role="img"
        aria-label={summary}
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-zinc-200/80 p-px ring-1 ring-inset ring-zinc-900/5 dark:bg-zinc-700/60 dark:ring-white/10"
      >
        {hasVotes && (
          <>
            <div
              data-testid="approve-segment"
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_8px_rgb(16_185_129_/_0.45)] transition-[width] duration-(--duration-snappy) ease-out"
              style={{ width: `${approvePct}%` }}
            />
            <div
              data-testid="reject-segment"
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500 shadow-[0_0_8px_rgb(244_63_94_/_0.4)] transition-[width] duration-(--duration-snappy) ease-out"
              style={{ width: `${rejectPct}%` }}
            />
          </>
        )}
      </div>

      <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
        <span className="tabular-nums">{t("approveCount", { count: upvotes })}</span>
        <span className="tabular-nums">{t("rejectCount", { count: downvotes })}</span>
      </div>
    </div>
  );
}
