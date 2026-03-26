'use client';

import { useState } from 'react';
import { Cause, Vote } from '../types';

interface VotingComponentProps {
  cause: Cause;
  userWalletAddress: string | null;
  onVote: (causeId: string, voteType: 'upvote' | 'downvote') => Promise<void>;
  userVote?: Vote;
  isVoting: boolean;
}

export default function VotingComponent({
  cause,
  userWalletAddress,
  onVote,
  userVote,
  isVoting
}: VotingComponentProps) {
  const [localVote, setLocalVote] = useState<'upvote' | 'downvote' | null>(
    userVote?.voteType || null
  );

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (!userWalletAddress) {
      alert('Please connect your wallet to vote');
      return;
    }

    if (isVoting) return;

    try {
      await onVote(cause.id, voteType);
      setLocalVote(voteType);
    } catch (error) {
      console.error('Voting failed:', error);
      alert('Failed to cast vote. Please try again.');
    }
  };

  const getVoteButtonClass = (voteType: 'upvote' | 'downvote') => {
    const isSelected = localVote === voteType;
    const baseClass = "flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-200 transform hover:scale-105";

    if (voteType === 'upvote') {
      return isSelected
        ? `${baseClass} bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-2 border-green-300 dark:border-green-700`
        : `${baseClass} bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-green-50 dark:hover:bg-green-900/20`;
    } else {
      return isSelected
        ? `${baseClass} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-2 border-red-300 dark:border-red-700`
        : `${baseClass} bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-2 border-zinc-300 dark:border-zinc-600 hover:bg-red-50 dark:hover:bg-red-900/20`;
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Vote on this cause</h3>

      <div className="flex gap-3">
        <button
          onClick={() => handleVote('upvote')}
          disabled={isVoting || !userWalletAddress}
          className={getVoteButtonClass('upvote')}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"></path>
          </svg>
          Approve
        </button>

        <button
          onClick={() => handleVote('downvote')}
          disabled={isVoting || !userWalletAddress}
          className={getVoteButtonClass('downvote')}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path>
          </svg>
          Reject
        </button>
      </div>

      <div className="text-center">
        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {cause.upvotes - cause.downvotes}
        </div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Net votes ({cause.totalVotes} total)
        </div>
      </div>

      <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full transition-all duration-300"
          style={{
            width: `${cause.totalVotes > 0 ? (cause.upvotes / cause.totalVotes) * 100 : 50}%`
          }}
        ></div>
      </div>

      <div className="flex justify-between w-full text-sm text-zinc-600 dark:text-zinc-400">
        <span>{cause.upvotes} Approve</span>
        <span>{cause.downvotes} Reject</span>
      </div>

      {!userWalletAddress && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          Connect your wallet to vote on this cause
        </p>
      )}

      {userVote && (
        <p className="text-sm text-green-600 dark:text-green-400 text-center">
          You voted to {userVote.voteType} this cause
        </p>
      )}
    </div>
  );
}