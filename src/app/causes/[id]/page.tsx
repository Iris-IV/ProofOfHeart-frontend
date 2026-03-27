'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Cause, Vote } from '../../../types';
import { getCauseById } from '../../../lib/mockCauses';
import { stellarVotingService } from '../../../services/stellarVoting';
import VotingComponent from '../../../components/VotingComponent';
import WalletConnection from '../../../components/WalletConnection';

const STATUS_STYLES: Record<Cause['status'], string> = {
  approved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  rejected: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
};

const CATEGORY_ICONS: Record<string, string> = {
  environment: '🌱',
  education: '📚',
  healthcare: '🏥',
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default function CauseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [cause, setCause] = useState<Cause | null>(null);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [userVote, setUserVote] = useState<Vote | undefined>(undefined);
  const [isVoting, setIsVoting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const found = getCauseById(id);
    if (!found) {
      setNotFound(true);
    } else {
      setCause(found);
    }
  }, [id]);

  useEffect(() => {
    if (!userWalletAddress || !cause) return;
    const existing = stellarVotingService.getUserVote(cause.id, userWalletAddress);
    if (existing) {
      setUserVote({
        causeId: cause.id,
        voter: userWalletAddress,
        voteType: existing.voteType,
        timestamp: existing.timestamp,
        transactionHash: 'mock-hash',
      });
    }
  }, [userWalletAddress, cause]);

  const handleWalletConnected = (publicKey: string) => setUserWalletAddress(publicKey);
  const handleWalletDisconnected = () => {
    setUserWalletAddress(null);
    setUserVote(undefined);
  };

  const handleVote = async (causeId: string, voteType: 'upvote' | 'downvote') => {
    if (!userWalletAddress) {
      alert('Please connect your wallet first');
      return;
    }
    if (stellarVotingService.hasUserVoted(causeId, userWalletAddress)) {
      alert('You have already voted on this cause');
      return;
    }
    setIsVoting(true);
    try {
      const transactionHash = await stellarVotingService.castVote(causeId, voteType, userWalletAddress);
      const newVote: Vote = {
        causeId,
        voter: userWalletAddress,
        voteType,
        timestamp: new Date(),
        transactionHash,
      };
      setUserVote(newVote);
      setCause((prev) =>
        prev
          ? {
              ...prev,
              upvotes: voteType === 'upvote' ? prev.upvotes + 1 : prev.upvotes,
              downvotes: voteType === 'downvote' ? prev.downvotes + 1 : prev.downvotes,
              totalVotes: prev.totalVotes + 1,
            }
          : prev
      );
    } catch {
      alert('Failed to cast vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
        
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

  if (!cause) return null;

  const fundingPct =
    cause.targetAmount && cause.targetAmount > 0
      ? Math.min(100, Math.round(((cause.currentAmount ?? 0) / cause.targetAmount) * 100))
      : 0;

  const approvalRate =
    cause.totalVotes > 0 ? Math.round((cause.upvotes / cause.totalVotes) * 100) : 0;

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
            <span className="text-zinc-900 dark:text-zinc-50 truncate max-w-xs">{cause.title}</span>
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
                <span className="text-2xl">{CATEGORY_ICONS[cause.category] ?? '💡'}</span>
                <span className="capitalize text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {cause.category}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[cause.status]}`}>
                  {cause.status.charAt(0).toUpperCase() + cause.status.slice(1)}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 leading-tight">
                {cause.title}
              </h1>

              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                {cause.description}
              </p>

              {cause.longDescription && (
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {cause.longDescription}
                </p>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{cause.totalVotes}</div>
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
                  {(cause.currentAmount ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">XLM Raised</div>
              </div>
            </div>

            {/* Funding progress */}
            {cause.targetAmount !== undefined && (
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Funding Progress</h2>
                <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                  <span>{(cause.currentAmount ?? 0).toLocaleString()} XLM raised</span>
                  <span>Goal: {cause.targetAmount.toLocaleString()} XLM</span>
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
              cause={cause}
              userWalletAddress={userWalletAddress}
              onVote={handleVote}
              userVote={userVote}
              isVoting={isVoting}
            />

            {/* Creator info */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Created by</h2>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                  {cause.creator.slice(1, 3).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-mono text-zinc-700 dark:text-zinc-300 break-all">
                    {cause.creator.slice(0, 10)}...{cause.creator.slice(-6)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(cause.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Vote breakdown */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Vote Breakdown</h2>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-green-600 dark:text-green-400 font-medium">✓ Approve ({cause.upvotes})</span>
                <span className="text-red-500 dark:text-red-400 font-medium">✗ Reject ({cause.downvotes})</span>
              </div>
              <div className="w-full bg-red-200 dark:bg-red-900/40 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: cause.totalVotes > 0 ? `${(cause.upvotes / cause.totalVotes) * 100}%` : '50%' }}
                />
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">{cause.totalVotes} total votes cast</p>
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
