"use client";

import { useId } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getMilestonesForCampaign } from "@/lib/milestoneAchievements";
import type { ContractMilestone } from "@/types";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { formatAmount } from "@/lib/formatters";
import { BPS_DENOMINATOR, expectedMilestonePayout } from "@/lib/contractClient";

const TOKEN_FULL_NAMES: Record<string, string> = {
  USDC: "USD Coin",
  XLM: "Stellar Lumens",
};

function replaceTokenSymbols(text: string): string {
  return text.replace(/\b([A-Z][A-Z0-9]{2,11})\b/g, (ticker) => TOKEN_FULL_NAMES[ticker] ?? ticker);
}

interface Props {
  amountRaised: bigint;
  compact?: boolean;
  /**
   * On-chain milestone payout plan (issue #1672). When provided the component
   * renders the contract plan — description, payout share, verified/claimed
   * state, admin verify action and creator claim action — instead of the
   * generic thank-you milestone badges.
   */
  onChainPlan?: OnChainPlan | null;
}

export interface OnChainPlan {
  /** Non-empty list from `get_milestones(campaignId)`. */
  milestones: ContractMilestone[];
  /** Result of `is_milestone_claimed(campaignId, milestoneId)` keyed by id. */
  claimed: Record<number, boolean>;
  /** Connected wallet is the platform admin. */
  isAdmin: boolean;
  /** Connected wallet is the campaign creator. */
  isCreator: boolean;
  /** campaign.amount_raised >= campaign.funding_goal */
  isFundingGoalMet: boolean;
  /** campaign.funds_withdrawn */
  isWithdrawn: boolean;
  /** Platform fee in bps, used to show the expected payout after fee. */
  platformFeeBps: number;
  onVerify: (milestoneId: number) => void | Promise<void>;
  onClaim: (milestoneId: number) => void | Promise<void>;
  isVerifyingId?: number | null;
  isClaimingId?: number | null;
}

/**
 * Claim gating mirrors the contract's `claim_milestone` checks so the button is
 * always enabled only when the on-chain call can succeed:
 * milestone verified && not claimed && funding goal met && campaign not withdrawn.
 */
export function canClaimMilestone(plan: {
  verified: boolean;
  claimed: boolean;
  isFundingGoalMet: boolean;
  isWithdrawn: boolean;
}): boolean {
  return plan.verified && !plan.claimed && plan.isFundingGoalMet && !plan.isWithdrawn;
}

export default function DonationMilestones({ amountRaised, compact = false, onChainPlan }: Props) {
  const t = useTranslations("MilestoneRoadmap");
  const headingId = useId();

  if (onChainPlan && onChainPlan.milestones.length > 0) {
    return <OnChainPlanSection plan={onChainPlan} amountRaised={amountRaised} />;
  }

  const milestones = getMilestonesForCampaign(amountRaised);
  const achieved = milestones.filter((m) => m.achieved);

  if (achieved.length === 0 && compact) return null;

  const nextId = milestones.find((milestone) => !milestone.achieved)?.id;
  const visibleMilestones = compact ? achieved : milestones;

  return (
    <section
      aria-labelledby={headingId}
      className={
        compact ? "py-2" : "rounded-surface bg-linear-to-br from-brand/5 to-accent/5 p-3 sm:p-4"
      }
    >
      <h3 id={headingId} className="mb-2 text-heading font-heading text-zinc-900 dark:text-zinc-50">
        {t("title")}
      </h3>
      {!compact && (
        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-300">{t("fundraisingHelp")}</p>
      )}
      <ol className={compact ? "flex flex-wrap gap-2" : "milestone-roadmap"}>
        {visibleMilestones.map((milestone) => {
          const current = milestone.id === nextId;
          const label = t(milestone.id);
          return (
            <li
              key={milestone.id}
              aria-current={current ? "step" : undefined}
              className={
                compact
                  ? "rounded-control bg-success/10 px-3 py-2 text-sm text-green-800 dark:text-green-300"
                  : "milestone-stop"
              }
              data-complete={milestone.achieved}
            >
              {compact ? (
                <span>
                  <span aria-hidden="true">{milestone.badge} </span>
                  {label}
                </span>
              ) : (
                <>
                  <span
                    className={`milestone-marker ${milestone.achieved ? "bg-success text-white" : current ? "bg-brand text-white" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"}`}
                    aria-hidden="true"
                  >
                    {milestone.achieved ? <Check size={16} /> : milestone.badge}
                  </span>
                  <details
                    open={current}
                    className="group min-w-0 rounded-control border border-zinc-200 bg-white/90 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90"
                  >
                    <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-control p-3 transition-colors duration-[140ms] hover:bg-brand/5 motion-reduce:transition-none">
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {label}
                        </span>
                        <span
                          className={`mt-1 block text-xs ${milestone.achieved ? "text-green-800 dark:text-green-300" : "text-zinc-600 dark:text-zinc-300"}`}
                        >
                          {milestone.achieved ? t("achieved") : current ? t("next") : t("upcoming")}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-zinc-600 transition-transform duration-[140ms] group-open:rotate-180 motion-reduce:transition-none dark:text-zinc-300"
                      />
                    </summary>
                    <div className="space-y-3 px-3 pb-4 text-sm text-zinc-600 dark:text-zinc-300">
                      <p>{t("threshold", { amount: stroopsToXlmNumber(milestone.threshold) })}</p>
                      <progress
                        aria-label={label}
                        value={milestone.progress}
                        max={100}
                        className="milestone-progress w-full"
                      />
                      <p>{t("progress", { percent: milestone.progress })}</p>
                    </div>
                  </details>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OnChainPlanSection({ plan, amountRaised }: { plan: OnChainPlan; amountRaised: bigint }) {
  const t = useTranslations("Milestones");
  const locale = useLocale();
  const roadmap = useTranslations("MilestoneRoadmap");
  const headingId = useId();
  const currentId = plan.milestones.find((milestone) => !plan.claimed[milestone.id])?.id;
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-surface bg-linear-to-br from-brand/5 to-accent/5 p-3 sm:p-4"
    >
      <h3
        id={headingId}
        className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2"
      >
        <span>🏅</span> {t("title")}
      </h3>
      <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-300">{roadmap("payoutHelp")}</p>
      <ol className="milestone-roadmap">
        {plan.milestones.map((m, index) => {
          const isClaimed = !!plan.claimed[m.id];
          const canClaim = canClaimMilestone({
            verified: m.verified,
            claimed: isClaimed,
            isFundingGoalMet: plan.isFundingGoalMet,
            isWithdrawn: plan.isWithdrawn,
          });
          const expectedPayout = expectedMilestonePayout(
            amountRaised,
            m.payout_bps,
            plan.platformFeeBps,
          );
          const sharePct = (m.payout_bps / BPS_DENOMINATOR) * 100;
          const isVerifying = plan.isVerifyingId === m.id;
          const isClaiming = plan.isClaimingId === m.id;
          const claimBlockedReasons: string[] = [];
          if (plan.isCreator && !isClaimed && !canClaim) {
            if (plan.isWithdrawn) claimBlockedReasons.push(t("claimBlockedByWithdrawn"));
            if (!plan.isFundingGoalMet) claimBlockedReasons.push(t("claimBlockedByGoal"));
            if (!m.verified) claimBlockedReasons.push(t("claimBlockedByUnverified"));
          }

          return (
            <li
              key={m.id}
              className="milestone-stop"
              data-complete={isClaimed}
              aria-current={m.id === currentId ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={`milestone-marker ${isClaimed ? "bg-success text-white" : m.id === currentId ? "bg-brand text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}
              >
                {isClaimed ? <Check size={16} /> : index + 1}
              </span>
              <details
                open
                className="group min-w-0 rounded-control border border-zinc-200 bg-white/90 p-3 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90"
              >
                <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-control text-zinc-900 dark:text-zinc-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-zinc-600 dark:text-zinc-300">
                      {roadmap("step", { number: index + 1 })}
                    </span>
                    <span className="mt-1 block break-words text-sm font-semibold">
                      {replaceTokenSymbols(m.description)}
                    </span>
                    <span
                      data-testid={`milestone-state-${m.id}`}
                      className={`mt-2 block text-xs font-medium ${isClaimed ? "text-green-800 dark:text-green-300" : m.verified ? "text-amber-800 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-300"}`}
                    >
                      {isClaimed
                        ? t("statusClaimed")
                        : m.verified
                          ? t("statusVerified")
                          : t("statusPending")}
                    </span>
                  </span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 transition-transform duration-[140ms] group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <div className="mt-3">
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    {t("payoutShare", { share: sharePct.toFixed(2) })}
                  </p>
                  {plan.isCreator && m.verified && !isClaimed && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {t("expectedPayout", { amount: formatAmount(expectedPayout, locale) })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {plan.isAdmin && !m.verified && !isClaimed && (
                    <button
                      type="button"
                      onClick={() => {
                        void plan.onVerify(m.id);
                      }}
                      disabled={isVerifying}
                      data-testid={`verify-milestone-${m.id}`}
                      className="tap-target focus-ring px-3 py-1.5 text-sm rounded-control bg-brand text-white font-medium hover:bg-brand-strong transition-colors duration-[140ms] motion-reduce:transition-none disabled:opacity-60"
                    >
                      {isVerifying ? t("verifyingAction") : t("verifyAction")}
                    </button>
                  )}
                  {plan.isAdmin && m.verified && !isClaimed && (
                    <span className="text-xs text-amber-800 dark:text-amber-300">
                      {t("verifiedByAdmin")}
                    </span>
                  )}
                  {plan.isCreator && !isClaimed && (
                    <button
                      type="button"
                      onClick={() => {
                        void plan.onClaim(m.id);
                      }}
                      disabled={!canClaim || isClaiming}
                      data-testid={`claim-milestone-${m.id}`}
                      title={
                        claimBlockedReasons.length > 0 ? claimBlockedReasons.join(" · ") : undefined
                      }
                      aria-disabled={!canClaim || isClaiming}
                      className={`tap-target focus-ring px-3 py-1.5 text-sm rounded-control font-medium transition-colors duration-[140ms] motion-reduce:transition-none ${
                        canClaim && !isClaiming
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed"
                      }`}
                    >
                      {isClaiming ? t("claimingAction") : t("claimAction")}
                    </button>
                  )}
                  {plan.isCreator &&
                    !isClaimed &&
                    claimBlockedReasons.map((reason) => (
                      <span
                        key={reason}
                        className="text-xs text-zinc-600 dark:text-zinc-300"
                        aria-live="polite"
                      >
                        {reason}
                      </span>
                    ))}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
