'use client';

import { useState } from 'react';
import { Cause, Vote } from '../types';
import VotingComponent from './VotingComponent';

interface CauseCardProps {
  cause: Cause;
  userWalletAddress: string | null;
  onVote: (causeId: string, voteType: 'upvote' | 'downvote') => Promise<void>;
  userVote?: Vote;
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

  const getStatusColor = (status: Cause['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              {cause.title}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3">
              {cause.description}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(cause.status)}`}>
            {cause.status.charAt(0).toUpperCase() + cause.status.slice(1)}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          <span>By: {cause.creator.slice(0, 6)}...{cause.creator.slice(-4)}</span>
          <span>•</span>
          <span>{formatDate(cause.createdAt)}</span>
          <span>•</span>
          <span className="capitalize">{cause.category}</span>
        </div>

        {cause.targetAmount && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400 mb-1">
              <span>Progress</span>
              <span>{cause.currentAmount || 0} / {cause.targetAmount} XLM</span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${cause.targetAmount > 0 ? ((cause.currentAmount || 0) / cause.targetAmount) * 100 : 0}%`
                }}
              ></div>
            </div>
          </div>
        )}

        <VotingComponent
          cause={cause}
          userWalletAddress={userWalletAddress}
          onVote={handleVote}
          userVote={userVote}
          isVoting={isVoting}
        />
      </div>
    </div>
  );
}