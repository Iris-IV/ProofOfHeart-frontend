"use client";

import { useState } from "react";
import { Campaign, Vote } from "../types";
import { useToast } from "./ToastProvider";
import { parseContractError } from "../utils/contractErrors";

interface VotingComponentProps {
  campaign: Campaign;
  userWalletAddress: string | null;
  onVote: (campaignId: number, voteType: "upvote" | "downvote") => Promise<void>;
  userVote?: Vote;
  isVoting: boolean;
  upvotes?: number;
  downvotes?: number;
  totalVotes?: number;
  /** Minimum total votes required before campaign can be verified. */
  minVotesQuorum?: number;
  /** Approval threshold in basis points (e.g. 5000 = 50%). */
  approvalThresholdBps?: number;
  /** Whether the connected wallet holds governance tokens. */
  isTokenHolder?: boolean;
  /** Called when "Verify with votes" is clicked. */
  onVerifyWithVotes?: () => Promise<void>;
  isVerifying?: boolean;
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
}: VotingComponentProps) {
  const [localVote, setLocalVote] = useState<"upvote" | "downvote" | null>(
    userVote?.voteType ?? null,
  );
  const { showError, showWarning } = useToast();

  const hasAlreadyVoted = !!userVote || !!localVote;
  const voteDisabled = isVoting || !userWalletAddress || !isTokenHolder || hasAlreadyVoted;

  const handleVote = async (voteType: "upvote" | "downvote") => {
    if (!userWalletAddress) {
      showWarning("Please connect your wallet to vote.");
      return;
    }
    if (!isTokenHolder) {
      showWarning("You must hold governance tokens to vote.");
      return;
    }
    if (hasAlreadyVoted) {
      showWarning("You have already voted on this cause.");
      return;
    }
    if (isVoting) return;
    try {
      await onVote(campaign.id, voteType);
      setLocalVote(voteType);
    } catch (error) {
      console.error("Voting failed:", error);
      showError(parseContractError(error));
    }
  };

  const getVoteButtonClass = (voteType: "upvote" | "downvote") => {
    const isSelected = localVote === voteType;
    const base =
      "flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-200 transform hover:motion-safe:scale-105";
    if (voteType === "upvote") {
      return isSelected
        ? `${base} bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-2 border-green-300 dark:border-green-700`
        : `${base} bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-green-50 dark:hover:bg-green-900/20`;
    }
    return isSelected
      ? `${base} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-2 border-red-300 dark:border-red-700`
      : `${base} bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-red-50 dark:hover:bg-red-900/20`;
  };

  // Quorum progress
  const quorumPct =
    minVotesQuorum && minVotesQuorum > 0
      ? Math.min(100, Math.round((totalVotes / minVotesQuorum) * 100))
      : null;

  // Approval rate in basis points
  const currentApprovalBps = totalVotes > 0 ? Math.round((upvotes / totalVotes) * 10000) : 0;
  const approvePercent = totalVotes > 0 ? Math.round((upvotes / totalVotes) * 100) : 50;
  const rejectPercent = 100 - approvePercent;

  // Verify button visible once quorum met and approval threshold reached
  const canVerify =
    !!onVerifyWithVotes &&
    minVotesQuorum !== undefined &&
    approvalThresholdBps !== undefined &&
    totalVotes >= minVotesQuorum &&
    currentApprovalBps >= approvalThresholdBps;

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Vote on this cause</h3>

      <div className="flex gap-3 w-full">
        <button
          onClick={() => handleVote("upvote")}
          disabled={voteDisabled}
          title={
            !userWalletAddress
              ? "Connect your wallet to vote"
              : !isTokenHolder
                ? "Token holders only"
                : hasAlreadyVoted
                  ? "Already voted"
                  : undefined
          }
          className={`${getVoteButtonClass("upvote")} flex-1 min-h-[44px] justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span aria-hidden="true">✓</span>
          <span>Approve</span>
        </button>

        <button
          onClick={() => handleVote("downvote")}
          disabled={voteDisabled}
          title={
            !userWalletAddress
              ? "Connect your wallet to vote"
              : !isTokenHolder
                ? "Token holders only"
                : hasAlreadyVoted
                  ? "Already voted"
                  : undefined
          }
          className={`${getVoteButtonClass("downvote")} flex-1 min-h-[44px] justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span aria-hidden="true">✕</span>
          <span>Reject</span>
        </button>
      </div>

      <div className="text-center">
        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {upvotes - downvotes}
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Net votes ({totalVotes} total)
        </div>
      </div>

      {/* Approval rate bar — green portion grows with approval, red background shows rejections */}
      <div className="w-full bg-red-300 dark:bg-red-900/60 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all duration-300"
          style={{
            width: `${approvePercent}%`,
          }}
        />
      </div>

      <p className="w-full text-center text-xs text-zinc-600 dark:text-zinc-400">
        {approvePercent}% Approve / {rejectPercent}% Reject
      </p>

      <div className="flex justify-between w-full text-sm text-zinc-600 dark:text-zinc-400">
        <span>{upvotes} Approve</span>
        <span>{downvotes} Reject</span>
      </div>

      {/* Quorum progress */}
      {quorumPct !== null && (
        <div className="w-full space-y-1">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Quorum progress</span>
            <span>
              {totalVotes} of {minVotesQuorum} votes needed
            </span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${quorumPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Status messages */}
      {!userWalletAddress && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          Connect your wallet to vote on this cause
        </p>
      )}

      {userWalletAddress && !isTokenHolder && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          Only governance token holders can vote on causes
        </p>
      )}

      {(userVote || localVote) && (
        <p className="text-sm text-green-600 dark:text-green-400 text-center">
          You voted to {userVote?.voteType ?? localVote} this cause
        </p>
      )}

      {/* Verify with votes button */}
      {canVerify && (
        <button
          onClick={onVerifyWithVotes}
          disabled={isVerifying}
          className="w-full min-h-[44px] py-2 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          {isVerifying ? "Verifying…" : "✓ Verify Campaign with Votes"}
        </button>
      )}
    </div>
  );
}
