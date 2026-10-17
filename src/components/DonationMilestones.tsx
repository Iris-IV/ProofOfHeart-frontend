"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { getMilestonesForCampaign } from "@/lib/milestoneAchievements";
import type { ContractMilestone } from "@/types";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { formatXlm } from "@/lib/formatters";
import {
  BPS_DENOMINATOR,
  expectedMilestonePayout,
} from "@/lib/contractClient";

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
  const contractPlan = useMemo(() => {
    if (!onChainPlan || onChainPlan.milestones.length === 0) return null;
    return { validated: true as const };
  }, [onChainPlan]);

  if (contractPlan && onChainPlan) {
    return <OnChainPlanSection plan={onChainPlan} amountRaised={amountRaised} />;
  }

  const milestones = getMilestonesForCampaign(amountRaised);
  const achieved = milestones.filter((m) => m.achieved);

  if (achieved.length === 0 && compact) return null;

  return (
    <section aria-labelledby="milestones-heading" className={compact ? "py-2" : "py-6"}>
      <h3
        id="milestones-heading"
        className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2"
      >
        <span>🏅</span> Donation Milestones
      </h3>
      <div className={compact ? "flex gap-2 flex-wrap" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
        {milestones.map((m) => {
          const label = replaceTokenSymbols(m.label);
          const description = replaceTokenSymbols(m.description);
          return (
            <div
              key={m.id}
              className={`rounded-xl border p-3 flex items-center gap-3 ${m.achieved ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" : "bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 opacity-60"}`}
            >
              <span className="text-2xl" aria-hidden>
                {m.badge}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 ">{label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{description}</p>
                {!m.achieved && (
                  <div className="mt-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${m.progress}%` }} />
                  </div>
                )}
              </div>
              {m.achieved && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Unlocked
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OnChainPlanSection({ plan, amountRaised }: { plan: OnChainPlan; amountRaised: bigint }) {
  const t = useTranslations("Milestones");
  return (
    <section aria-labelledby="milestone-plan-heading" className="py-6">
      <h3
        id="milestone-plan-heading"
        className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2"
      >
        <span>🏅</span> {t("title")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {plan.milestones.map((m) => {
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
            <div
              key={m.id}
              className={`rounded-xl border p-3 ${isClaimed ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : m.verified ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" : "bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {replaceTokenSymbols(m.description)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("payoutShare", { share: sharePct.toFixed(2) })}
                  </p>
                  {plan.isCreator && m.verified && !isClaimed && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                      {t("expectedPayout", {
                        amount: formatXlm(stroopsToXlmNumber(expectedPayout), "en"),
                      })}
                    </p>
                  )}
                </div>
                <span
                  data-testid={`milestone-state-${m.id}`}
                  className={`text-xs font-medium ${isClaimed ? "text-green-600 dark:text-green-400" : m.verified ? "text-amber-600 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {isClaimed ? t("statusClaimed") : m.verified ? t("statusVerified") : t("statusPending")}
                </span>
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
                    className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isVerifying ? t("verifyingAction") : t("verifyAction")}
                  </button>
                )}
                {plan.isAdmin && m.verified && !isClaimed && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
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
                    title={claimBlockedReasons.length > 0 ? claimBlockedReasons.join(" · ") : undefined}
                    aria-disabled={!canClaim || isClaiming}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                      canClaim && !isClaiming
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 cursor-not-allowed"
                    }`}
                  >
                    {isClaiming ? t("claimingAction") : t("claimAction")}
                  </button>
                )}
                {plan.isCreator && !isClaimed && claimBlockedReasons.map((reason) => (
                  <span key={reason} className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
