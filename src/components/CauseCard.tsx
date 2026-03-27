'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cause, Vote } from '../types';
import VotingComponent from './VotingComponent';

interface CauseCardProps {
  cause: Cause;
  userWalletAddress: string | null;
  onVote: (causeId: string, voteType: 'upvote' | 'downvote') => Promise<void>;
  userVote?: Vote;
}

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
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function CauseCard({ cause, userWalletAddress, onVote, userVote }: CauseCardProps) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (causeId: string, voteType: 'upvote' | 'downvote') => {
    setIsVoting(true);
    try {
      await onVote(causeId, voteType);
    } finally {
      setIsVoting(false);
    }
  };

  const fundingPct =
    cause.targetAmount && cause.targetAmount > 0
      ? Math.min(100, Math.round(((cause.currentAmount ?? 0) / cause.targetAmount) * 100))
      : 0;

  const approvalRate =
    cause.totalVotes > 0 ? Math.round((cause.upvotes / cause.totalVotes) * 100) : 0;

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Card body */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{CATEGORY_ICONS[cause.category] ?? '💡'}</span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 capitalize">
              {cause.category}
            </span>
          </div>
          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[cause.status]}`}>
            {cause.status.charAt(0).toUpperCase() + cause.status.slice(1)}
          </span>
        </div>

        <Link href={`/causes/${cause.id}`} className="group block mb-2">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
            {cause.title}
          </h3>
        </Link>

        <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-2 mb-4">
          {cause.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          <span>By {formatAddress(cause.creator)}</span>
          <span>{formatDate(cause.createdAt)}</span>
          <span>{cause.totalVotes} votes · {approvalRate}% approval</span>
        </div>

        {cause.targetAmount !== undefined && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
              <span className="font-medium">{fundingPct}% funded</span>
              <span>{(cause.currentAmount ?? 0).toLocaleString()} / {cause.targetAmount.toLocaleString()} XLM</span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${fundingPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Voting */}
      <div className="px-5 pb-5">
        <VotingComponent
          cause={cause}
          userWalletAddress={userWalletAddress}
          onVote={handleVote}
          userVote={userVote}
          isVoting={isVoting}
        />
      </div>

      {/* Footer link */}
      <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
        <Link
          href={`/causes/${cause.id}`}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          View full details →
        </Link>
      </div>
    </div>
  );
}