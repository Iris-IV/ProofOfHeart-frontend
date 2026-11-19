"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Campaign, Vote } from "../types";
import AsyncButtonContent from "./AsyncButtonContent";
import VoteTallyBreakdown from "./VoteTallyBreakdown";
import { useToast } from "./ToastProvider";
import { parseContractError } from "../utils/contractErrors";
import { getAsyncActionErrorMessage, withActionTimeout } from "../utils/asyncAction";

interface VotingComponentProps {
  campaign: Campaign;
  userWalletAddress: string | null;
  onVote: (campaignId: number, voteType: "upvote" | "downvote") => Promise<void>;
  userVote?: Vote;
  isVoting: boolean;
  upvotes?: number;
  downvotes?: number;
  totalVotes?: number;
  minVotesQuorum?: number;
  approvalThresholdBps?: number;
  isTokenHolder?: boolean;
  onVerifyWithVotes?: () => Promise<void>;
  isVerifying?: boolean;
  /** Tallies stream live from contract events (shows a "Live" indicator). */
  isLive?: boolean;
  /** Delegators whose vote can be cast by the connected delegate. */
  delegatedVoters?: string[];
  onCastDelegatedVote?: (delegator: string, voteType: "upvote" | "downvote") => Promise<void>;
}

export default function VotingComponent({
  campaign,
  userWalletAddress,
  onVote,
  userVote,
  isVoting,
  upvotes = 0,
  downvotes = 0,
  totalVotes = 0,
  minVotesQuorum,
  approvalThresholdBps,
  isTokenHolder = true,
  onVerifyWithVotes,
  isVerifying = false,
  isLive = false,
  delegatedVoters = [],
  onCastDelegatedVote,
}: VotingComponentProps) {
  const t = useTranslations("Voting");
  const tContractErrors = useTranslations("ContractErrors");
  const [localVote, setLocalVote] = useState<"upvote" | "downvote" | null>(
    userVote?.voteType ?? null,
  );
  const [delegatedVote, setDelegatedVote] = useState<string | null>(null);
  const { showError, showWarning } = useToast();

  const localizeContractError = (message: string) =>
    message.startsWith("ContractErrors.") ? tContractErrors(message) : message;

  const hasAlreadyVoted = !!userVote || !!localVote;
  const voteDisabled = isVoting || !userWalletAddress || !isTokenHolder || hasAlreadyVoted;

  const handleVote = async (voteType: "upvote" | "downvote") => {
    if (!userWalletAddress) {
      showWarning(t("connectWalletToVote"));
      return;
    }
    if (!isTokenHolder) {
      showWarning(t("mustHoldTokens"));
      return;
    }
    if (hasAlreadyVoted) {
      showWarning(t("alreadyVotedWarning"));
      return;
    }
    if (isVoting) return;
    try {
      await withActionTimeout(onVote(campaign.id, voteType));
      setLocalVote(voteType);
    } catch (error) {
      console.error("Voting failed:", error);
      showError(localizeContractError(getAsyncActionErrorMessage(error, parseContractError)), {
        action: { label: t("retryVote"), onClick: () => void handleVote(voteType) },
      });
    }
  };

  const getVoteButtonClass = (voteType: "upvote" | "downvote") => {
    const isSelected = localVote === voteType;
    const base =
      "flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-200 transform hover:motion-safe:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-2";
    if (voteType === "upvote") {
      return isSelected
        ? `${base} bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-2 border-green-300 dark:border-green-700`
        : `${base} bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-green-50 dark:hover:bg-green-900/20`;
    }
    return isSelected
      ? `${base} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-2 border-red-300 dark:border-red-700`
      : `${base} bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-red-50 dark:hover:bg-red-900/20`;
  };

  const getDisabledTitle = () => {
    if (!userWalletAddress) return t("connectWalletTitle");
    if (!isTokenHolder) return t("tokenHoldersOnly");
    if (hasAlreadyVoted) return t("alreadyVotedTitle");
    return undefined;
  };

  const quorumPct =
    minVotesQuorum && minVotesQuorum > 0
      ? Math.min(100, Math.round((totalVotes / minVotesQuorum) * 100))
      : null;

  const currentApprovalBps = totalVotes > 0 ? Math.round((upvotes / totalVotes) * 10000) : 0;
  const approvalThresholdPct =
    approvalThresholdBps !== undefined ? approvalThresholdBps / 100 : null;
  const approvalProgressPct =
    approvalThresholdBps && approvalThresholdBps > 0
      ? Math.min(100, Math.round((currentApprovalBps / approvalThresholdBps) * 100))
      : null;

  const canVerify =
    !!onVerifyWithVotes &&
    minVotesQuorum !== undefined &&
    approvalThresholdBps !== undefined &&
    totalVotes >= minVotesQuorum &&
    currentApprovalBps >= approvalThresholdBps;

  const verificationStatus =
    minVotesQuorum !== undefined && approvalThresholdBps !== undefined
      ? totalVotes < minVotesQuorum
        ? t("needMoreVotes", { count: minVotesQuorum - totalVotes })
        : currentApprovalBps < approvalThresholdBps
          ? t("needMoreApproval", {
              count: Math.ceil((approvalThresholdBps - currentApprovalBps) / 100),
            })
          : t("quorumReached")
      : null;

  const votedType = userVote?.voteType ?? localVote;

  return (
    <div className="glass-surface flex flex-col items-center gap-4 rounded-surface p-4 sm:p-5">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("title")}</h3>

      <div className="flex gap-3 w-full">
        <button
          onClick={() => void handleVote("upvote")}
          disabled={voteDisabled}
          aria-label={t("approveCampaignAria")}
          title={getDisabledTitle()}
          className={`${getVoteButtonClass("upvote")} flex-1 min-h-[44px] justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <AsyncButtonContent
            isPending={isVoting}
            idleLabel={
              <>
                <span aria-hidden="true">✓</span>
                <span>{t("approve")}</span>
              </>
            }
            pendingLabel={t("processingVote")}
          />
        </button>

        <button
          onClick={() => void handleVote("downvote")}
          disabled={voteDisabled}
          aria-label={t("rejectCampaignAria")}
          title={getDisabledTitle()}
          className={`${getVoteButtonClass("downvote")} flex-1 min-h-[44px] justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <AsyncButtonContent
            isPending={isVoting}
            idleLabel={
              <>
                <span aria-hidden="true">✕</span>
                <span>{t("reject")}</span>
              </>
            }
            pendingLabel={t("processingVote")}
          />
        </button>
      </div>

      <div className="text-center">
        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {upvotes - downvotes}
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("netVotes", { total: totalVotes })}
        </div>
      </div>

      <VoteTallyBreakdown upvotes={upvotes} downvotes={downvotes} live={isLive} />

      {onCastDelegatedVote && delegatedVoters.length > 0 && (
        <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            {t("delegatedVotesTitle")}
          </p>
          <div className="mt-3 space-y-2">
            {delegatedVoters.map((delegator) => (
              <div
                key={delegator}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="break-all font-mono text-xs text-blue-800 dark:text-blue-300">
                  {delegator}
                </span>
                <div className="flex gap-2">
                  {(["upvote", "downvote"] as const).map((voteType) => (
                    <button
                      key={voteType}
                      type="button"
                      disabled={delegatedVote === delegator}
                      onClick={() =>
                        void onCastDelegatedVote(delegator, voteType).then(() =>
                          setDelegatedVote(delegator),
                        )
                      }
                      className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {voteType === "upvote" ? t("approve") : t("reject")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {quorumPct !== null && (
        <div className="w-full space-y-1">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{t("quorumProgress")}</span>
            <span>{t("votesOfQuorum", { current: totalVotes, quorum: minVotesQuorum ?? 0 })}</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${quorumPct}%` }}
            />
          </div>
        </div>
      )}

      {approvalThresholdPct !== null && (
        <div className="w-full space-y-1">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{t("approvalThreshold")}</span>
            <span>
              {t("approvalOfThreshold", {
                current: currentApprovalBps / 100,
                threshold: approvalThresholdPct,
              })}
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${approvalProgressPct ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {verificationStatus && (
        <p className="w-full rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
          {verificationStatus}
        </p>
      )}

      {!userWalletAddress && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          {t("connectWalletPrompt")}
        </p>
      )}

      {userWalletAddress && !isTokenHolder && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          {t("tokenHoldersOnlyPrompt")}
        </p>
      )}

      {votedType && (
        <p className="text-sm text-green-600 dark:text-green-400 text-center">
          {votedType === "upvote" ? t("votedUpvote") : t("votedDownvote")}
        </p>
      )}

      {canVerify && (
        <button
          onClick={() => void onVerifyWithVotes?.()}
          disabled={isVerifying}
          className="w-full min-h-[44px] py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm inline-flex items-center justify-center gap-2"
        >
          <AsyncButtonContent
            isPending={isVerifying}
            idleLabel={t("verifyWithVotes")}
            pendingLabel={t("verifying")}
          />
        </button>
      )}
    </div>
  );
}
