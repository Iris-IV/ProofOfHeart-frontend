'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Campaign, Vote } from '../types';
import VotingComponent from './VotingComponent';
import CancelCampaignModal from './cancelCampaignModal';

interface CauseCardProps {
  campaign: Campaign;
  userWalletAddress: string | null;
  onVote: (campaignId: number, voteType: 'upvote' | 'downvote') => Promise<void>;
  onCancel: (campaignId: number) => Promise<void>;
  onClaimRefund: (campaignId: number) => Promise<void>;
  userVote?: Vote;
}

const STATUS_STYLES: Record<Campaign['status'], string> = {
  approved:  'bg-green-100  dark:bg-green-900  text-green-800  dark:text-green-200',
  rejected:  'bg-red-100    dark:bg-red-900    text-red-800    dark:text-red-200',
  pending:   'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  cancelled: 'bg-zinc-100   dark:bg-zinc-700   text-zinc-600   dark:text-zinc-300',
};

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

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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

  const progressPct = campaign.targetAmount > 0
    ? Math.min(100, Math.round((campaign.currentAmount / campaign.targetAmount) * 100))
    : 0;

  // Visibility rules:
  // - Cancel button: current wallet IS the creator, campaign not cancelled, funds not withdrawn
  const isCreator =
    !!userWalletAddress && userWalletAddress === campaign.creator;
  const showCancelButton =
    isCreator &&
    campaign.status !== 'cancelled' &&
    !campaign.fundsWithdrawn;

  // - Claim Refund button: campaign is cancelled, wallet is connected and not the creator
  //   (creators don't have contributions to refund)
  const showClaimRefund =
    campaign.status === 'cancelled' &&
    !!userWalletAddress &&
    userWalletAddress !== campaign.creator;

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
    <>
      <div className="flex flex-col bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-shadow hover:shadow-md">
        <div className="p-5 flex-1 space-y-3">
          {/* Top row: category + status */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {CATEGORY_ICONS[campaign.category] ?? '📌'}{' '}
              {campaign.category.charAt(0).toUpperCase() + campaign.category.slice(1)}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[campaign.status]}`}
            >
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </span>
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
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                ${campaign.currentAmount.toLocaleString()} raised
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Goal: ${campaign.targetAmount.toLocaleString()}
            </p>
          </div>

          {/* Creator + date */}
          <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500 pt-1">
            <span title={campaign.creator}>
              By {formatAddress(campaign.creator)}
              {isCreator && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                  You
                </span>
              )}
            </span>
            <span>{formatDate(campaign.createdAt)}</span>
          </div>
        </div>

        {/* Bottom: voting + actions */}
        <div className="px-5 pb-5 space-y-3">
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

          {/* Claim Refund — visible to contributors after cancellation */}
          {showClaimRefund && (
            <button
              type="button"
              onClick={handleClaimRefund}
              disabled={isClaimingRefund}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {isClaimingRefund ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                  Claiming Refund…
                </>
              ) : (
                '↩ Claim Refund'
              )}
            </button>
          )}

          {/* Cancel — visible only to creator when cancellation is still possible */}
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
      </div>

      {/* Confirmation modal */}
      <CancelCampaignModal
        campaignTitle={campaign.title}
        isOpen={isCancelModalOpen}
        isCancelling={isCancelling}
        onConfirm={handleCancelConfirm}
        onClose={() => setIsCancelModalOpen(false)}
      />
    </>
  );
}