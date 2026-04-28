'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import CampaignActions from '@/components/CampaignActions';
import CampaignStatusBadge from '@/components/CampaignStatusBadge';
import DeadlineCountdown from '@/components/DeadlineCountdown';
import DonationModal from '@/components/DonationModal';
import FundingProgressBar from '@/components/FundingProgressBar';
import ReportModal from '@/components/ReportModal';
import RevenueSharingPanel from '@/components/RevenueSharingPanel';
import ShareButtons from '@/components/ShareButtons';
import { useToast } from '@/components/ToastProvider';
import UpdatesSection from '@/components/UpdatesSection';
import VotingComponent from '@/components/VotingComponent';
import { useWallet } from '@/components/WalletContext';
import { useCampaign } from '@/hooks/useCampaign';
import { usePlatformFee } from '@/hooks/usePlatformFee';
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
} from '@/lib/contractClient';
import { Campaign, Vote, CATEGORY_LABELS, stroopsToXlm } from '@/types';
import { parseContractError } from '@/utils/contractErrors';

function formatDate(ts: number) {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(ts * 1000));
}

export default function CauseDetailClient({ id }: { id: string }) {
  const { publicKey: userWalletAddress } = useWallet();
  const { campaign: fetchedCampaign, isLoading, error, refetch } = useCampaign(Number(id));
  const { platformFeeBps, isLoading: isPlatformFeeLoading, isFallback } = usePlatformFee();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [userVote, setUserVote] = useState<Vote | undefined>(undefined);
  const [isVoting, setIsVoting] = useState(false);
  const [voteCounts, setVoteCounts] = useState({ upvotes: 0, downvotes: 0, totalVotes: 0 });
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
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

  useEffect(() => { if (fetchedCampaign) setCampaign(fetchedCampaign); }, [fetchedCampaign]);

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
        // silently ignore
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
            voteType: 'upvote',
            timestamp: new Date(),
            transactionHash: '',
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
      } catch {
        // ignore
      }
    };
    loadContribution();
  }, [userWalletAddress, campaign, refundTxHash]);

  const handleVote = async (campaignId: number, voteType: 'upvote' | 'downvote') => {
    if (!userWalletAddress) { showWarning('Please connect your wallet first.'); return; }
    setIsVoting(true);
    try {
      const transactionHash = await voteOnCampaign(campaignId, userWalletAddress, voteType === 'upvote');
      setUserVote({ causeId: String(campaignId), voter: userWalletAddress, voteType, timestamp: new Date(), transactionHash });
      setVoteCounts((prev) => ({
        upvotes: voteType === 'upvote' ? prev.upvotes + 1 : prev.upvotes,
        downvotes: voteType === 'downvote' ? prev.downvotes + 1 : prev.downvotes,
        totalVotes: prev.totalVotes + 1,
      }));
      showSuccess('Your vote has been cast successfully.');
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
      showSuccess('Campaign verified successfully via community vote!');
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
      showSuccess('Refund claimed successfully!');
    } catch (error) {
      const msg = parseContractError(error);
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('no funds')) {
        setAlreadyRefunded(true);
        showWarning('Refund already claimed or no funds to refund.');
      } else {
        showError(msg);
      }
    } finally {
      setIsClaimingRefund(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="motion-safe:animate-pulse space-y-6">
            <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded w-48" />
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4">
              <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 h-20" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        <main className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Failed to load cause</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">{error}</p>
          <Link href="/causes" className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors">
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
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Cause not found</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">This cause does not exist or has been removed.</p>
          <Link href="/causes" className="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors">
            ← Back to Causes
          </Link>
        </main>
      </div>
    );
  }

  const raised = stroopsToXlm(campaign.amount_raised);
  const goal = stroopsToXlm(campaign.funding_goal);
  const fundingPct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const approvalRate = voteCounts.totalVotes > 0 ? Math.round((voteCounts.upvotes / voteCounts.totalVotes) * 100) : 0;
  const voteBreakdownApprovePct = voteCounts.totalVotes > 0 ? approvalRate : 50;
  const voteBreakdownRejectPct = 100 - voteBreakdownApprovePct;
  const categoryLabel = CATEGORY_LABELS[campaign.category] ?? 'Other';
  const platformFeePercent = platformFeeBps / 100;
  const estimatedFeeAmount = raised * (platformFeeBps / 10000);
  const estimatedCreatorReceives = raised - estimatedFeeAmount;

  const now = Math.floor(Date.now() / 1000);
  const isRefundEligible =
    campaign.is_cancelled ||
    (now > campaign.deadline && campaign.amount_raised < campaign.funding_goal);
  const refundableXlm = stroopsToXlm(refundableAmount);

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <nav className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <Link href="/causes" className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Causes</Link>
            <span>›</span>
            <span className="text-zinc-900 dark:text-zinc-50 truncate max-w-xs">{campaign.title}</span>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{categoryLabel}</span>
                <CampaignStatusBadge campaign={campaign} />
              </div>
              {campaign.cover_image_url && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-4 bg-zinc-100 dark:bg-zinc-700">
                  <Image
                    src={campaign.cover_image_url}
                    alt={campaign.title}
                    fill
                    unoptimized
                    loading="lazy"
                    className="object-cover"
                  />
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 leading-tight">{campaign.title}</h1>
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                  {campaign.description}
                </ReactMarkdown>
              </div>

              {/* Share + Report toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-700">
                <ShareButtons
                  url={typeof window !== 'undefined' ? window.location.href : `https://proofofheart.org/causes/${campaign.id}`}
                  title={campaign.title}
                />
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  🚩 Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Votes', value: voteCounts.totalVotes, cls: 'text-zinc-900 dark:text-zinc-50' },
                { label: 'Approval Rate', value: `${approvalRate}%`, cls: 'text-green-600 dark:text-green-400' },
                { label: 'Funded', value: `${fundingPct}%`, cls: 'text-blue-600 dark:text-blue-400' },
                { label: 'XLM Raised', value: raised.toLocaleString(undefined, { maximumFractionDigits: 2 }), cls: 'text-zinc-900 dark:text-zinc-50' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                  <div className={`text-2xl font-bold ${cls}`}>{value}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Campaign Deadline</h2>
              <DeadlineCountdown deadline={campaign.deadline} />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Ends {formatDate(campaign.deadline)}</p>
            </div>

            {campaign.funding_goal > BigInt(0) && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Funding Progress</h2>
                <FundingProgressBar amountRaised={campaign.amount_raised} fundingGoal={campaign.funding_goal} />
              </div>
            )}

            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Platform Fee</h2>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  {isPlatformFeeLoading ? 'Loading…' : `${platformFeePercent.toFixed(2)}%`}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                A platform fee of {platformFeePercent.toFixed(2)}% is deducted from funds when withdrawn by the creator.
                Based on the current amount raised, that is {estimatedFeeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM in fees and {estimatedCreatorReceives.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM delivered to the creator.
              </p>
              {isFallback && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">The on-chain fee getter is not available yet, so this page is using the current known fallback fee of 3%.</p>}
            </div>

            {campaign.has_revenue_sharing && (
              <RevenueSharingPanel
                campaign={campaign}
                onActionSuccess={refetch}
              />
            )}

            {isRefundEligible && userWalletAddress && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-amber-200 dark:border-amber-700 p-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                  💸 Claim Refund
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  {campaign.is_cancelled
                    ? 'This campaign was cancelled. Contributors can reclaim their tokens.'
                    : 'This campaign did not reach its funding goal by the deadline. Contributors can reclaim their tokens.'}
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
                      Your refundable contribution:{' '}
                      <span className="font-semibold">
                        {refundableXlm.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
                      </span>
                    </p>
                    <button
                      onClick={handleClaimRefund}
                      disabled={isClaimingRefund}
                      className="w-full min-h-[44px] py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors text-sm"
                    >
                      {isClaimingRefund ? 'Processing…' : 'Claim Refund'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No contribution found for your wallet, or refund already claimed.
                  </p>
                )}
              </div>
            )}

            {/* Updates Section */}
            <UpdatesSection campaign={campaign} />
          </div>

          <div className="space-y-6">
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

            {campaign.is_active && !campaign.is_cancelled && (
              <button
                onClick={() => { if (!userWalletAddress) { showWarning('Please connect your wallet first.'); return; } setIsDonationModalOpen(true); }}
                className="w-full py-3 min-h-[44px] bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
              >
                💜 Fund This Cause
              </button>
            )}

            <CampaignActions campaign={campaign} onActionSuccess={refetch} />

            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Created by</h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">{campaign.creator.slice(1, 3).toUpperCase()}</div>
                <div>
                  <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">{campaign.creator.slice(0, 10)}...{campaign.creator.slice(-6)}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Deadline: {formatDate(campaign.deadline)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Vote Breakdown</h2>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-green-600 dark:text-green-400 font-medium">✓ Approve ({voteCounts.upvotes})</span>
                <span className="text-red-500 dark:text-red-400 font-medium">✗ Reject ({voteCounts.downvotes})</span>
              </div>
              <div className="w-full bg-red-200 dark:bg-red-900/40 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${voteBreakdownApprovePct}%` }} />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                {voteBreakdownApprovePct}% Approve / {voteBreakdownRejectPct}% Reject
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">{voteCounts.totalVotes} total votes cast</p>
            </div>

            <Link href="/causes" className="block text-center px-4 py-3 min-h-[44px] border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-full text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
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

      {isReportModalOpen && (
        <ReportModal
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          reporterAddress={userWalletAddress}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}
    </div>
  );
}
