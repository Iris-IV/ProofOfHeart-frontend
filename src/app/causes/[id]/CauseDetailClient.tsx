"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Campaign, Vote, CATEGORY_LABELS, stroopsToXlm } from "../../../types";
import { useCampaign } from "../../../hooks/useCampaign";
import { useToast } from "../../../components/ToastProvider";
import { parseContractError } from "../../../utils/contractErrors";
import {
  voteOnCampaign,
  getApproveVotes,
  getRejectVotes,
  hasVoted,
  getMinVotesQuorum,
  getApprovalThresholdBps,
  verifyCampaignWithVotes,
  getContribution,
  claimRefund,
} from "../../../lib/contractClient";
import VotingComponent from "../../../components/VotingComponent";
import CampaignStatusBadge from "../../../components/CampaignStatusBadge";
import DeadlineCountdown from "../../../components/DeadlineCountdown";
import FundingProgressBar from "../../../components/FundingProgressBar";
import { useWallet } from "../../../components/WalletContext";
import CampaignActions from "../../../components/CampaignActions";
import DonationModal from "../../../components/DonationModal";
import { CauseDetailSkeleton } from "../../../components/Skeleton";

function formatDate(ts: number) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(ts * 1000));
}

export default function CauseDetailClient({ id }: { id: string }) {
  const { publicKey: userWalletAddress } = useWallet();

  const { campaign: fetchedCampaign, isLoading, error, refetch } = useCampaign(Number(id));

  // Local copy for optimistic vote updates
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [userVote, setUserVote] = useState<Vote | undefined>(undefined);
  const [isVoting, setIsVoting] = useState(false);
  const [voteCounts, setVoteCounts] = useState({ upvotes: 0, downvotes: 0, totalVotes: 0 });
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const { showError, showSuccess, showWarning } = useToast();

  // Quorum / threshold state
  const [minVotesQuorum, setMinVotesQuorum] = useState<number | undefined>(undefined);
  const [approvalThresholdBps, setApprovalThresholdBps] = useState<number | undefined>(undefined);
  const [isVerifying, setIsVerifying] = useState(false);

  // Refund state
  const [refundableAmount, setRefundableAmount] = useState<bigint>(BigInt(0));
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const [refundTxHash, setRefundTxHash] = useState<string | null>(null);
  const [alreadyRefunded, setAlreadyRefunded] = useState(false);

  useEffect(() => {
    if (fetchedCampaign) setCampaign(fetchedCampaign);
  }, [fetchedCampaign]);

  // Load vote counts + quorum config whenever campaign changes
  useEffect(() => {
    if (!campaign) return;
    const load = async () => {
      try {
        const [approves, rejects, quorum, threshold] = await Promise.all([
          getApproveVotes(campaign.id),
          getRejectVotes(campaign.id),
          getMinVotesQuorum(),
          getApprovalThresholdBps(),
        ]);
        setVoteCounts({ upvotes: approves, downvotes: rejects, totalVotes: approves + rejects });
        setMinVotesQuorum(quorum);
        setApprovalThresholdBps(threshold);
      } catch {
        // silently ignore — UI can still function without live vote counts
      }
    };
    load();
  }, [campaign]);

  // Check whether the connected wallet has already voted
  useEffect(() => {
    if (!userWalletAddress || !campaign) return;
    const check = async () => {
      try {
        const voted = await hasVoted(campaign.id, userWalletAddress);
        if (voted) {
          setUserVote({
            causeId: String(campaign.id),
            voter: userWalletAddress,
            voteType: "upvote", // exact type unknown from contract; UI shows "already voted"
            timestamp: new Date(),
            transactionHash: "",
          });
        }
      } catch {
        // ignore
      }
    };
    check();
  }, [userWalletAddress, campaign]);

  // Load refundable contribution
  useEffect(() => {
    if (!userWalletAddress || !campaign) return;
    const loadContribution = async () => {
      try {
        const amount = await getContribution(campaign.id, userWalletAddress);
        setRefundableAmount(amount);
        if (amount === BigInt(0) && refundTxHash) {
          // contribution zeroed after successful refund
          setAlreadyRefunded(true);
        }
      } catch {
        // ignore
      }
    };
    loadContribution();
  }, [userWalletAddress, campaign, refundTxHash]);

  const handleVote = async (campaignId: number, voteType: "upvote" | "downvote") => {
    if (!userWalletAddress) {
      showWarning("Please connect your wallet first.");
      return;
    }
    setIsVoting(true);
    try {
      const txHash = await voteOnCampaign(campaignId, userWalletAddress, voteType === "upvote");
      const newVote: Vote = {
        causeId: String(campaignId),
        voter: userWalletAddress,
        voteType,
        timestamp: new Date(),
        transactionHash: txHash,
      };
      setUserVote(newVote);
      setVoteCounts((prev) => ({
        upvotes: voteType === "upvote" ? prev.upvotes + 1 : prev.upvotes,
        downvotes: voteType === "downvote" ? prev.downvotes + 1 : prev.downvotes,
        totalVotes: prev.totalVotes + 1,
      }));
      showSuccess("Your vote has been cast successfully.");
      refetch();
    } catch (error) {
      showError(parseContractError(error));
    } finally {
      setIsVoting(false);
    }
  };

  const handleVerifyWithVotes = async () => {
    setIsVerifying(true);
    try {
      await verifyCampaignWithVotes(Number(id));
      showSuccess("Campaign verified successfully via community vote!");
      refetch();
    } catch (error) {
      showError(parseContractError(error));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClaimRefund = async () => {
    if (!userWalletAddress || !campaign) return;
    setIsClaimingRefund(true);
    try {
      const txHash = await claimRefund(campaign.id, userWalletAddress);
      setRefundTxHash(txHash);
      setRefundableAmount(BigInt(0));
      showSuccess("Refund claimed successfully!");
    } catch (error) {
      const msg = parseContractError(error);
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("no funds")) {
        setAlreadyRefunded(true);
        showWarning("Refund already claimed or no funds to refund.");
      } else {
        showError(msg);
      }
    } finally {
      setIsClaimingRefund(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (isLoading) {
    return <CauseDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        <main className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
            Failed to load cause
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">{error}</p>
          <Link
            href="/causes"
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
          >
            ← Back to Causes
          </Link>
        </main>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        <main className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
            Cause not found
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            This cause does not exist or has been removed.
          </p>
          <Link
            href="/causes"
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
          >
            ← Back to Causes
          </Link>
        </main>
      </div>
    );
  }

  const raised = stroopsToXlm(campaign.amount_raised);
  const goal = stroopsToXlm(campaign.funding_goal);
  const fundingPct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  const approvalRate =
    voteCounts.totalVotes > 0 ? Math.round((voteCounts.upvotes / voteCounts.totalVotes) * 100) : 0;
  const voteBreakdownApprovePct = voteCounts.totalVotes > 0 ? approvalRate : 50;
  const voteBreakdownRejectPct = 100 - voteBreakdownApprovePct;

  const categoryLabel = CATEGORY_LABELS[campaign.category] ?? "Other";

  const now = Math.floor(Date.now() / 1000);
  const isRefundEligible =
    campaign.is_cancelled ||
    (now > campaign.deadline && campaign.amount_raised < campaign.funding_goal);

  const refundableXlm = stroopsToXlm(refundableAmount);

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Breadcrumb + Wallet */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <nav className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <Link
              href="/causes"
              className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              Causes
            </Link>
            <span>›</span>
            <span className="text-zinc-900 dark:text-zinc-50 truncate max-w-xs">
              {campaign.title}
            </span>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content – left 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & status */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {categoryLabel}
                </span>
                <CampaignStatusBadge campaign={campaign} />
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 leading-tight">
                {campaign.title}
              </h1>

              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {campaign.description}
              </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {voteCounts.totalVotes}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Total Votes</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {approvalRate}%
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Approval Rate</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {fundingPct}%
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Funded</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {raised.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">XLM Raised</div>
              </div>
            </div>

            {/* Deadline countdown */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Campaign Deadline
              </h2>
              <DeadlineCountdown deadline={campaign.deadline} />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                Ends {formatDate(campaign.deadline)}
              </p>
            </div>

            {/* Funding progress */}
            {campaign.funding_goal > BigInt(0) && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                  Funding Progress
                </h2>
                <FundingProgressBar
                  amountRaised={campaign.amount_raised}
                  fundingGoal={campaign.funding_goal}
                />
              </div>
            )}

            {/* Claim Refund section */}
            {isRefundEligible && userWalletAddress && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-700 p-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                  💸 Claim Refund
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  {campaign.is_cancelled
                    ? "This campaign was cancelled. Contributors can reclaim their tokens."
                    : "This campaign did not reach its funding goal by the deadline. Contributors can reclaim their tokens."}
                </p>

                {alreadyRefunded || refundTxHash ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      ✓ Refund successfully claimed
                    </p>
                    {refundTxHash && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono break-all">
                        Tx: {refundTxHash}
                      </p>
                    )}
                  </div>
                ) : refundableAmount > BigInt(0) ? (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      Your refundable contribution:{" "}
                      <span className="font-semibold">
                        {refundableXlm.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
                      </span>
                    </p>
                    <button
                      onClick={handleClaimRefund}
                      disabled={isClaimingRefund}
                      className="w-full min-h-[44px] py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
                    >
                      {isClaimingRefund ? "Processing…" : "Claim Refund"}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {refundableAmount === BigInt(0) && alreadyRefunded
                      ? "Already refunded."
                      : "No contribution found for your wallet, or refund already claimed."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sidebar – right col */}
          <div className="space-y-6">
            {/* Voting */}
            <VotingComponent
              campaign={campaign}
              userWalletAddress={userWalletAddress}
              onVote={handleVote}
              userVote={userVote}
              isVoting={isVoting}
              upvotes={voteCounts.upvotes}
              downvotes={voteCounts.downvotes}
              totalVotes={voteCounts.totalVotes}
              minVotesQuorum={minVotesQuorum}
              approvalThresholdBps={approvalThresholdBps}
              onVerifyWithVotes={handleVerifyWithVotes}
              isVerifying={isVerifying}
            />

            {/* Donate button */}
            {campaign.is_active && !campaign.is_cancelled && (
              <button
                onClick={() => {
                  if (!userWalletAddress) {
                    showWarning("Please connect your wallet first.");
                    return;
                  }
                  setIsDonationModalOpen(true);
                }}
                className="w-full py-3 min-h-[44px] bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
              >
                💜 Fund This Cause
              </button>
            )}

            {/* Role-aware actions */}
            <CampaignActions campaign={campaign} onActionSuccess={refetch} />

            {/* Creator info */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Created by
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                  {campaign.creator.slice(1, 3).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">
                    {campaign.creator.slice(0, 10)}...{campaign.creator.slice(-6)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Deadline: {formatDate(campaign.deadline)}
                  </p>
                </div>
              </div>
            </div>

            {/* Vote breakdown */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">
                Vote Breakdown
              </h2>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ Approve ({voteCounts.upvotes})
                </span>
                <span className="text-red-500 dark:text-red-400 font-medium">
                  ✗ Reject ({voteCounts.downvotes})
                </span>
              </div>
              <div className="w-full bg-red-200 dark:bg-red-900/40 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${voteBreakdownApprovePct}%`,
                  }}
                />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                {voteBreakdownApprovePct}% Approve / {voteBreakdownRejectPct}% Reject
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                {voteCounts.totalVotes} total votes cast
              </p>
            </div>

            <Link
              href="/causes"
              className="block text-center px-4 py-3 min-h-[44px] border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-full text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Back to all causes
            </Link>
          </div>
        </div>
      </main>

      {isDonationModalOpen && (
        <DonationModal
          campaign={campaign}
          onClose={() => setIsDonationModalOpen(false)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
