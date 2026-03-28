'use client';

import { useState, useEffect, useCallback } from 'react';
import { Campaign } from '../types';
import { useToast } from './ToastProvider';
import { parseContractError } from '../utils/contractErrors';
import {
  voteOnCampaign,
  getApproveVotes,
  getRejectVotes,
  hasVoted,
  verifyWithVotes,
  getMinVotesQuorum,
  getApprovalThresholdBps,
} from '../lib/contractClient';

interface VotingComponentProps {
  campaign: Campaign;
  userWalletAddress: string | null;
  /** Called after a successful vote so the parent can refresh campaign data. */
  onVoteSuccess?: () => void;
}

interface VoteState {
  approves: number;
  rejects: number;
  quorum: number;
  thresholdBps: number;
  alreadyVoted: boolean;
  isLoading: boolean;
}

export default function VotingComponent({
  campaign,
  userWalletAddress,
  onVoteSuccess,
}: VotingComponentProps) {
  const { showError, showWarning, showSuccess } = useToast();

  const [voteState, setVoteState] = useState<VoteState>({
    approves: campaign.upvotes,
    rejects: campaign.downvotes,
    quorum: 10,
    thresholdBps: 6000,
    alreadyVoted: false,
    isLoading: true,
  });
  const [isVoting, setIsVoting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch live vote counts + quorum config + has_voted status
  const fetchVoteData = useCallback(async () => {
    setVoteState((s) => ({ ...s, isLoading: true }));
    try {
      const [approves, rejects, quorum, thresholdBps] = await Promise.all([
        getApproveVotes(campaign.id),
        getRejectVotes(campaign.id),
        getMinVotesQuorum(),
        getApprovalThresholdBps(),
      ]);

      const alreadyVoted = userWalletAddress
        ? await hasVoted(campaign.id, userWalletAddress)
        : false;

      setVoteState({ approves, rejects, quorum, thresholdBps, alreadyVoted, isLoading: false });
    } catch (err) {
      // Fall back to campaign prop values on error so UI still renders
      setVoteState((s) => ({
        ...s,
        approves: campaign.upvotes,
        rejects: campaign.downvotes,
        isLoading: false,
      }));
    }
  }, [campaign.id, campaign.upvotes, campaign.downvotes, userWalletAddress]);

  useEffect(() => {
    fetchVoteData();
  }, [fetchVoteData]);

  const totalVotes = voteState.approves + voteState.rejects;
  const approvalRate =
    totalVotes > 0 ? Math.round((voteState.approves / totalVotes) * 100) : 0;
  const quorumMet = totalVotes >= voteState.quorum;
  const thresholdMet = approvalRate >= voteState.thresholdBps / 100;
  const canVerify = quorumMet && thresholdMet && campaign.status === 'pending';

  const handleVote = async (approve: boolean) => {
    if (!userWalletAddress) {
      showWarning('Please connect your wallet to vote.');
      return;
    }
    if (voteState.alreadyVoted) {
      showWarning('You have already voted on this campaign.');
      return;
    }
    setIsVoting(true);
    try {
      await voteOnCampaign(campaign.id, userWalletAddress, approve);
      showSuccess('Your vote has been cast successfully.');
      await fetchVoteData();
      onVoteSuccess?.();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsVoting(false);
    }
  };

  const handleVerify = async () => {
    if (!userWalletAddress) {
      showWarning('Please connect your wallet to verify.');
      return;
    }
    setIsVerifying(true);
    try {
      await verifyWithVotes(campaign.id);
      showSuccess('Campaign verified successfully.');
      onVoteSuccess?.();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const btnBase =
    'flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Vote on this cause</h3>

      {/* Vote buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleVote(true)}
          disabled={isVoting || !userWalletAddress || voteState.alreadyVoted || voteState.isLoading}
          className={`${btnBase} bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-green-50 dark:hover:bg-green-900/20`}
          title={voteState.alreadyVoted ? 'You have already voted' : 'Approve this cause'}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Approve
        </button>

        <button
          onClick={() => handleVote(false)}
          disabled={isVoting || !userWalletAddress || voteState.alreadyVoted || voteState.isLoading}
          className={`${btnBase} bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-red-50 dark:hover:bg-red-900/20`}
          title={voteState.alreadyVoted ? 'You have already voted' : 'Reject this cause'}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          Reject
        </button>
      </div>

      {/* Approval rate bar */}
      <div className="w-full">
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400 mb-1">
          <span>{voteState.approves} Approve</span>
          <span>{approvalRate}% approval</span>
          <span>{voteState.rejects} Reject</span>
        </div>
        <div className="w-full bg-red-200 dark:bg-red-900/40 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalVotes > 0 ? approvalRate : 50}%` }}
          />
        </div>
      </div>

      {/* Quorum progress */}
      <div className="w-full">
        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
          <span>Voting quorum</span>
          <span>
            {totalVotes} of {voteState.quorum} votes needed
          </span>
        </div>
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${quorumMet ? 'bg-blue-500' : 'bg-zinc-400'}`}
            style={{ width: `${Math.min(100, (totalVotes / voteState.quorum) * 100)}%` }}
          />
        </div>
      </div>

      {/* Verify button — shown only when quorum + threshold are met */}
      {canVerify && (
        <button
          onClick={handleVerify}
          disabled={isVerifying || !userWalletAddress}
          className={`${btnBase} w-full justify-center bg-blue-600 hover:bg-blue-700 text-white border-0`}
        >
          {isVerifying ? 'Verifying…' : 'Verify with votes'}
        </button>
      )}

      {/* Status messages */}
      {!userWalletAddress && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          Connect your wallet to vote on this cause
        </p>
      )}

      {voteState.alreadyVoted && (
        <p className="text-sm text-green-600 dark:text-green-400 text-center">
          You have already voted on this campaign
        </p>
      )}
    </div>
  );
}
