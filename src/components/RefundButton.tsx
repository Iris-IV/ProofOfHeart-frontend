'use client';

import { Campaign } from '../types';
import { useRefund } from '../hooks/useRefund';

interface RefundButtonProps {
  campaign: Campaign;
  contributor: string | null;
}

/**
 * Conditionally rendered refund UI for the campaign detail page.
 *
 * Shows a "Claim Refund" button when:
 *  1. The campaign is refund-eligible (cancelled or failed)
 *  2. The connected wallet has a non-zero contribution
 *
 * After a successful refund it shows the refunded amount and tx hash.
 */
export default function RefundButton({ campaign, contributor }: RefundButtonProps) {
  const {
    contributionAmount,
    isRefundEligible,
    isLoadingContribution,
    isRefunding,
    isRefunded,
    refundedAmount,
    transactionHash,
    error,
    claimRefundAction,
  } = useRefund(campaign, contributor);

  // Don't render anything if the campaign isn't refund-eligible
  if (!isRefundEligible) return null;

  // Don't render if no wallet is connected
  if (!contributor) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">💰</span>
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Refund Available
          </h2>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          This campaign is eligible for refunds.{' '}
          {campaign.isCancelled
            ? 'The campaign was cancelled by the creator.'
            : 'The deadline has passed and the funding goal was not reached.'}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          Connect your wallet to check if you can claim a refund.
        </p>
      </div>
    );
  }

  // Loading contribution amount
  if (isLoadingContribution) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">💰</span>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Checking Refund Eligibility…
          </h2>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
          <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
        </div>
      </div>
    );
  }

  // No contribution — nothing to refund
  if (contributionAmount === 0 && !isRefunded) {
    return null;
  }

  // Successful refund state
  if (isRefunded && refundedAmount !== null) {
    return (
      <div
        id="refund-success-card"
        className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center text-green-600 dark:text-green-300 text-sm font-bold">
            ✓
          </span>
          <h2 className="text-sm font-semibold text-green-800 dark:text-green-200">
            Refund Claimed Successfully
          </h2>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-700 dark:text-green-300">Refunded Amount</span>
            <span className="font-bold text-green-800 dark:text-green-200">
              {refundedAmount.toLocaleString()} XLM
            </span>
          </div>
          {transactionHash && (
            <div className="text-xs text-green-600 dark:text-green-400 break-all mt-2 p-2 bg-green-100 dark:bg-green-800/50 rounded-lg">
              <span className="font-medium">Tx Hash: </span>
              {transactionHash}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Refund button (main state)
  return (
    <div
      id="refund-claim-card"
      className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">💰</span>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Claim Your Refund
        </h2>
      </div>

      {/* Reason */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
        {campaign.isCancelled
          ? 'This campaign was cancelled. You can reclaim your contribution.'
          : 'The deadline passed and the funding goal was not reached. You can reclaim your contribution.'}
      </p>

      {/* Contribution info */}
      <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-3 mb-4">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Your contribution</span>
        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {contributionAmount.toLocaleString()} XLM
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mb-3">
          {error}
        </div>
      )}

      {/* Claim button */}
      <button
        id="claim-refund-button"
        onClick={claimRefundAction}
        disabled={isRefunding}
        className="w-full py-2.5 px-4 rounded-full font-semibold text-sm transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg"
      >
        {isRefunding ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Processing Refund…
          </span>
        ) : (
          `Claim Refund — ${contributionAmount.toLocaleString()} XLM`
        )}
      </button>
    </div>
  );
}
