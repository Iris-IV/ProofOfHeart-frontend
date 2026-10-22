"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Clock, PenLine, ShieldCheck, UserCheck, UserRound } from "lucide-react";
import {
  useMultiSigProposals,
  type MultiSigProposal,
  type MultiSigProposalStatus,
} from "@/hooks/useMultiSigProposals";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatAddress } from "@/lib/formatAddress";
import { formatRelativeTime } from "@/lib/formatters";
import type { MultiSigAggregator } from "@/lib/multiSigAggregator";
import AnimatedProgressFill from "./AnimatedProgressFill";
import Badge, { type BadgeTone } from "./ui/Badge";
import { cn } from "./ui/cn";

/**
 * Status badges pair an icon and a text label with the tone (WCAG 1.4.1), and
 * reuse the Badge intents: pending is `warning` everywhere.
 */
const STATUS_CONFIG: Record<
  MultiSigProposalStatus,
  { tone: BadgeTone; Icon: React.ElementType; labelKey: string }
> = {
  awaiting: { tone: "neutral", Icon: Clock, labelKey: "statusAwaiting" },
  collecting: { tone: "warning", Icon: PenLine, labelKey: "statusCollecting" },
  ready: { tone: "success", Icon: CheckCircle2, labelKey: "statusReady" },
};

const GLASS_SURFACE =
  "rounded-surface border border-white/60 bg-white/70 shadow-lg shadow-accent/5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/60";

/** Under 150ms so state changes feel immediate. */
const TRANSITION = { duration: 0.14, ease: "easeOut" } as const;

export function MultiSigStatusBadge({ status }: { status: MultiSigProposalStatus }) {
  const t = useTranslations("MultiSig");
  const { tone, Icon, labelKey } = STATUS_CONFIG[status];
  return (
    <Badge tone={tone} data-testid={`multisig-status-${status}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(labelKey)}
    </Badge>
  );
}

function ProposalCard({ proposal }: { proposal: MultiSigProposal }) {
  const t = useTranslations("MultiSig");
  const locale = useLocale();
  const titleId = `multisig-proposal-${proposal.campaignId}`;
  // One slot per required signer; extra signatures beyond the threshold still show.
  const slotCount = Math.max(proposal.requiredSignatures, proposal.signedCount);
  const slots = Array.from({ length: slotCount }, (_, i) => proposal.signatures[i] ?? null);

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        GLASS_SURFACE,
        "flex h-full flex-col gap-4 p-4 sm:p-5 transition-shadow duration-(--duration-fast) hover:shadow-xl",
        proposal.status === "ready" && "ring-1 ring-success/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={titleId} className="text-base font-heading text-zinc-900 dark:text-zinc-50">
          {t("campaign", { id: proposal.campaignId })}
        </h3>
        <MultiSigStatusBadge status={proposal.status} />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">
            {t("threshold", {
              signed: proposal.signedCount,
              required: proposal.requiredSignatures,
            })}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {proposal.remaining > 0
              ? t("remaining", { count: proposal.remaining })
              : t("thresholdMet")}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={t("progressLabel", { id: proposal.campaignId })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={proposal.progressPct}
          className="h-1.5 overflow-hidden rounded-full bg-zinc-900/10 dark:bg-white/10"
        >
          <AnimatedProgressFill targetPct={proposal.progressPct} />
        </div>
      </div>

      <ul aria-label={t("matrixLabel")} className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
        {slots.map((signature, index) => (
          <li
            key={signature?.signer ?? `slot-${index}`}
            data-testid={signature ? "multisig-slot-signed" : "multisig-slot-pending"}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-control border px-2.5 py-2 text-xs transition-colors duration-(--duration-fast)",
              signature
                ? "border-success/30 bg-success/10 text-zinc-800 dark:text-zinc-100"
                : "border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400",
            )}
          >
            {signature ? (
              <UserCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {signature ? (
              <span className="min-w-0">
                <span className="block truncate font-mono" title={signature.signer}>
                  {formatAddress(signature.signer)}
                </span>
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                  {t("signedAt", { time: formatRelativeTime(signature.timestamp, locale) })}
                </span>
              </span>
            ) : (
              <span>{t("awaitingSigner", { index: index + 1 })}</span>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

export interface MultiSigProposalDashboardProps {
  /** Defaults to the app-wide singleton; injectable for tests and stories. */
  aggregator?: MultiSigAggregator;
  className?: string;
}

/**
 * Governance view of multi-sig campaign-cancellation proposals: a status badge,
 * threshold progress and a signer approval matrix per proposal. Cards fade in
 * and re-flow with a 140ms layout animation (none under reduced motion); the
 * grid is one column on phones, two on tablets and three from 1280px.
 */
export default function MultiSigProposalDashboard({
  aggregator,
  className,
}: MultiSigProposalDashboardProps) {
  const t = useTranslations("MultiSig");
  const prefersReducedMotion = useReducedMotion();
  const { proposals, pendingCount, readyCount } = useMultiSigProposals(aggregator);

  return (
    <section aria-labelledby="multisig-dashboard-title" className={cn("w-full", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
        <h2
          id="multisig-dashboard-title"
          className="flex items-center gap-2 text-[clamp(1.25rem,1.2vw+1rem,1.5rem)] font-bold text-zinc-900 dark:text-zinc-50"
        >
          <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
          {t("dashboardTitle")}
        </h2>
        <div className="flex flex-wrap gap-2" aria-live="polite">
          <Badge tone="warning">{t("pendingCount", { count: pendingCount })}</Badge>
          <Badge tone="success">{t("readyCount", { count: readyCount })}</Badge>
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className={cn(GLASS_SURFACE, "campaign-empty-state p-8 text-center sm:p-12")}>
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-zinc-400" aria-hidden="true" />
          <p className="font-semibold text-zinc-700 dark:text-zinc-200">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-card-gap md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {proposals.map((proposal) => (
              <motion.li
                key={proposal.campaignId}
                layout={!prefersReducedMotion}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                transition={TRANSITION}
              >
                <ProposalCard proposal={proposal} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
