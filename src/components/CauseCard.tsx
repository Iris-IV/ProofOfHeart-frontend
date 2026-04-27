'use client';

import { useState } from 'react';
import { formatAddress } from '@/lib/formatAddress';
import { Campaign, Vote, CATEGORY_LABELS } from '../types';
import CampaignStatusBadge from './CampaignStatusBadge';
import CancelCampaignModal from './cancelCampaignModal';
import DeadlineCountdown from './DeadlineCountdown';
import FundingProgressBar from './FundingProgressBar';
import VotingComponent from './VotingComponent';

interface CauseCardProps {
  campaign: Campaign;
  userWalletAddress: string | null;
  onVote: (campaignId: number, voteType: 'upvote' | 'downvote') => Promise<void>;
  onCancel: (campaignId: number) => Promise<void>;
  onClaimRefund: (campaignId: number) => Promise<void>;
  userVote?: Vote;
}

const CATEGORY_ICONS: Record<string, string> = {
  environment: '🌱',
  education:   '📚',
  healthcare:  '🏥',
};

function formatDate(ts: number) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(ts * 1000));
}


export default function CauseCard({
  campaign,
  userWalletAddress,
  onVote,
  onCancel,
  onClaimRefund,
  userVote,
}: CauseCardProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);

  const progressPct =
    campaign.funding_goal > BigInt(0)
      ? Math.min(100, Math.round((Number(campaign.amount_raised) / Number(campaign.funding_goal)) * 100))
      : 0;

  const isCreator =
    !!userWalletAddress && userWalletAddress === campaign.creator;

  const showCancelButton =
    isCreator &&
    campaign.status !== 'cancelled' &&
    !campaign.funds_withdrawn;

  const showClaimRefund =
    campaign.status === 'cancelled' &&
    !!userWalletAddress &&
    userWalletAddress !== campaign.creator;

  const categoryLabel =
    CATEGORY_LABELS?.[campaign.category] ?? campaign.category;

  const categoryIcon = CATEGORY_ICONS[campaign.category] ?? '';

  const handleVote = async (_campaignId: number, voteType: 'upvote' | 'downvote') => {
    setIsVoting(true);
    try {
      await onVote(campaign.id, voteType);
    } finally {
      setIsVoting(false);
    }
  };

  const handleCancelConfirm = async () => {
    setIsCancelling(true);
    try {
      await onCancel(campaign.id);
      setIsCancelModalOpen(false);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleClaimRefund = async () => {
    setIsClaimingRefund(true);
    try {
      await onClaimRefund(campaign.id);
    } finally {
      setIsClaimingRefund(false);
    }
  };

  return (
    <div className="flex flex-col bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-md transition-shadow duration-200">

      {/* ── Card body ── */}
      <div className="p-5 flex-1 space-y-3">

        {/* Category + status */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {categoryIcon} {categoryLabel}
          </span>
          <CampaignStatusBadge campaign={campaign} />
        </div>

        {/* Title */}
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 leading-snug line-clamp-2">
          {campaign.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
          {campaign.description}
        </p>

        {/* Funding progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>${campaign.amount_raised.toLocaleString()} raised</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Goal: ${campaign.funding_goal.toLocaleString()}
          </p>
        </div>

        {/* Extended funding bar (BigInt path) */}
        {campaign.funding_goal > BigInt(0) && (
          <FundingProgressBar
            amountRaised={campaign.amount_raised}
            fundingGoal={campaign.funding_goal}
          />
        )}

        {/* Creator + deadline */}
        <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span title={campaign.creator}>
            By {formatAddress(campaign.creator)}
            {isCreator && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                You
              </span>
            )}
          </span>
          <DeadlineCountdown deadline={campaign.deadline} />
        </div>

        {/* Created date */}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Created {formatDate(campaign.created_at)}
        </p>
      </div>

      {/* ── Actions ── */}
      <div className="px-5 pb-5 space-y-3">

        {/* Voting — hidden when cancelled */}
        {campaign.status !== 'cancelled' && (
          <VotingComponent
            campaign={campaign}
            userVote={userVote}
            isVoting={isVoting}
            onVote={handleVote}
            userWalletAddress={userWalletAddress}
          />
        )}

        {/* Cancelled banner */}
        {campaign.status === 'cancelled' && (
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-600 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
            This campaign has been cancelled.
          </div>
        )}

        {/* Claim Refund — contributors only, after cancellation */}
        {showClaimRefund && (
          <button
            type="button"
            onClick={handleClaimRefund}
            disabled={isClaimingRefund}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {isClaimingRefund ? (
              <>
                <span className="inline-block motion-safe:animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                Claiming Refund…
              </>
            ) : (
              '↩ Claim Refund'
            )}
          </button>
        )}

        {/* Cancel — creator only, while still possible */}
        {showCancelButton && (
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="w-full py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Cancel Campaign
          </button>
        )}
      </div>

      {/* Confirmation modal */}
      <CancelCampaignModal
        campaignTitle={campaign.title}
        isOpen={isCancelModalOpen}
        isCancelling={isCancelling}
        onConfirm={handleCancelConfirm}
        onClose={() => setIsCancelModalOpen(false)}
      />
    </div>
  );
}