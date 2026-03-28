'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Campaign, Vote, CATEGORY_LABELS, deriveCampaignStatus, stroopsToXlm } from '../types';
import VotingComponent from './VotingComponent';
import CampaignStatusBadge from './CampaignStatusBadge';
import FundingProgressBar from './FundingProgressBar';
import DeadlineCountdown from './DeadlineCountdown';

interface CauseCardProps {
  campaign: Campaign;
  userWalletAddress: string | null;
  onVote: (campaignId: number, voteType: 'upvote' | 'downvote') => Promise<void>;
  userVote?: Vote;
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function CauseCard({ campaign, userWalletAddress, onVote, userVote }: CauseCardProps) {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (campaignId: number, voteType: 'upvote' | 'downvote') => {
    setIsVoting(true);
    try {
      await onVote(campaignId, voteType);
    } finally {
      setIsVoting(false);
    }
  };

  const categoryLabel = CATEGORY_LABELS[campaign.category] ?? 'Other';

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Card body */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {categoryLabel}
            </span>
          </div>
          <CampaignStatusBadge campaign={campaign} />
        </div>

        <Link href={`/causes/${campaign.id}`} className="group block mb-2">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-2">
            {campaign.title}
          </h3>
        </Link>

        <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-2 mb-4">
          {campaign.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          <span>By {formatAddress(campaign.creator)}</span>
          <DeadlineCountdown deadline={campaign.deadline} />
        </div>

        {campaign.funding_goal > BigInt(0) && (
          <div className="mb-4">
            <FundingProgressBar
              amountRaised={campaign.amount_raised}
              fundingGoal={campaign.funding_goal}
            />
          </div>
        )}
      </div>

      {/* Voting */}
      <div className="px-5 pb-5">
        <VotingComponent
          campaign={campaign}
          userWalletAddress={userWalletAddress}
          onVote={handleVote}
          userVote={userVote}
          isVoting={isVoting}
        />
      </div>

      {/* Footer link */}
      <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
        <Link
          href={`/causes/${campaign.id}`}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          View full details →
        </Link>
      </div>
    </div>
  );
}
