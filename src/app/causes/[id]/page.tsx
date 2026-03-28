'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Campaign, Vote } from '../../../types';
import { useCampaign } from '../../../hooks/useCampaign';
import { stellarVotingService } from '../../../services/stellarVoting';
import { useToast } from '../../../components/ToastProvider';
import { parseContractError } from '../../../utils/contractErrors';
import VotingComponent from '../../../components/VotingComponent';
import WalletConnection from '../../../components/WalletConnection';
import RefundButton from '../../../components/RefundButton';

const STATUS_STYLES: Record<Campaign['status'], string> = {
  approved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  rejected: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
};

const CATEGORY_ICONS: Record<string, string> = {
  environment: '🌱',
  education: '📚',
  healthcare: '🏥',
};

function formatDate(ts: number) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(ts * 1000));
}

export default function CauseDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { campaign: fetchedCampaign, isLoading, error, notFound } = useCampaign(id);

  // Local copy for optimistic vote updates
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<Vote | undefined>(undefined);
  const [isVoting, setIsVoting] = useState(false);
  const { showError, showSuccess, showWarning } = useToast();

  useEffect(() => {
    if (fetchedCampaign) setCampaign(fetchedCampaign);
  }, [fetchedCampaign]);

  useEffect(() => {
    if (!userWalletAddress || !campaign) return;
    const existing = stellarVotingService.getUserVote(String(campaign.id), userWalletAddress);
    if (existing) {
      setUserVote({
        causeId: String(campaign.id),
        voter: userWalletAddress,
        voteType: existing.voteType,
        timestamp: existing.timestamp,
        transactionHash: 'mock-hash',
      });
    }
  }, [userWalletAddress, campaign]);

  const handleWalletConnected = (publicKey: string) => setUserWalletAddress(publicKey);
  const handleWalletDisconnected = () => {
    setUserWalletAddress(null);
    setUserVote(undefined);
  };

  const handleVote = async (campaignId: number, voteType: 'upvote' | 'downvote') => {
    if (!userWalletAddress) {
      showWarning('Please connect your wallet first.');
      return;
    }
    const id = String(campaignId);
    if (stellarVotingService.hasUserVoted(id, userWalletAddress)) {
      showWarning('You have already voted on this cause.');
      return;
    }
    setIsVoting(true);
    try {
      const transactionHash = await stellarVotingService.castVote(id, voteType, userWalletAddress);
      const newVote: Vote = {
        causeId: id,
        voter: userWalletAddress,
        voteType,
        timestamp: new Date(),
        transactionHash,
      };
      setUserVote(newVote);
      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              upvotes: voteType === 'upvote' ? prev.upvotes + 1 : prev.upvotes,
              downvotes: voteType === 'downvote' ? prev.downvotes + 1 : prev.downvotes,
              totalVotes: prev.totalVotes + 1,
            }
          : prev
      );
      showSuccess('Your vote has been cast successfully.');
    } catch (error) {
      showError(parseContractError(error));
    } finally {
      setIsVoting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="animate-pulse space-y-6">
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
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

  if (notFound || !campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        <main className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">Cause not found</h1>
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

  const fundingPct =
    campaign.targetAmount > 0
      ? Math.min(100, Math.round((campaign.currentAmount / campaign.targetAmount) * 100))
      : 0;

  const approvalRate =
    campaign.totalVotes > 0 ? Math.round((campaign.upvotes / campaign.totalVotes) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Breadcrumb + Wallet */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <nav className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
            <Link href="/causes" className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
              Causes
            </Link>
            <span>›</span>
            <span className="text-zinc-900 dark:text-zinc-50 truncate max-w-xs">{campaign.title}</span>
          </nav>
          <WalletConnection
            onWalletConnected={handleWalletConnected}
            onWalletDisconnected={handleWalletDisconnected}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content – left 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & status */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-2xl">{CATEGORY_ICONS[campaign.category] ?? '💡'}</span>
                <span className="capitalize text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {campaign.category}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[campaign.status]}`}>
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </span>
                {campaign.isCancelled && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                    Cancelled
                  </span>
                )}
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
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{campaign.totalVotes}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Total Votes</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{approvalRate}%</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Approval Rate</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fundingPct}%</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Funded</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {campaign.currentAmount.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">XLM Raised</div>
              </div>
            </div>

            {/* Funding progress */}
            {campaign.targetAmount > 0 && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                  Funding Progress
                </h2>
                <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                  <span>{campaign.currentAmount.toLocaleString()} XLM raised</span>
                  <span>Goal: {campaign.targetAmount.toLocaleString()} XLM</span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3 mb-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${fundingPct}%` }}
                  />
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{fundingPct}% of goal reached</p>
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
            />

            {/* Refund claiming (shown only when eligible) */}
            <RefundButton
              campaign={campaign}
              contributor={userWalletAddress}
            />

            {/* Creator info */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Created by</h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                  {campaign.creator.slice(1, 3).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">
                    {campaign.creator.slice(0, 10)}...{campaign.creator.slice(-6)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(campaign.createdAt)}
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
                  ✓ Approve ({campaign.upvotes})
                </span>
                <span className="text-red-500 dark:text-red-400 font-medium">
                  ✗ Reject ({campaign.downvotes})
                </span>
              </div>
              <div className="w-full bg-red-200 dark:bg-red-900/40 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width:
                      campaign.totalVotes > 0
                        ? `${(campaign.upvotes / campaign.totalVotes) * 100}%`
                        : '50%',
                  }}
                />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                {campaign.totalVotes} total votes cast
              </p>
            </div>

            <Link
              href="/causes"
              className="block text-center px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-full text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              ← Back to all causes
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
