'use client';

import React, { useState } from 'react';
import { Campaign, basisPointsToPercentage, stroopsToXlm, xlmToStroops } from '../types';
import { useWallet } from './WalletContext';
import { useAdmin } from '../hooks/useAdmin';
import { useContribution } from '../hooks/useContribution';
import { usePlatformFee } from '../hooks/usePlatformFee';
import {
  contribute,
  cancelCampaign,
  claimRefund,
  verifyCampaign
} from '../lib/contractClient';
import { useToast } from './ToastProvider';
import { parseContractError } from '../utils/contractErrors';
import WithdrawFunds from './WithdrawFunds';
import { Spinner } from './Skeleton';

interface CampaignActionsProps {
  campaign: Campaign;
  onActionSuccess?: () => void;
}

export default function CampaignActions({ campaign, onActionSuccess }: CampaignActionsProps) {
  const { publicKey, connectWallet, isWalletConnected } = useWallet();
  const { admin } = useAdmin();
  const { contribution } = useContribution(campaign.id, publicKey);
  const { platformFeeBps } = usePlatformFee();
  const { showSuccess, showError, showWarning } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [contributionAmount, setContributionAmount] = useState('');

  const isCreator = publicKey === campaign.creator;
  const isAdmin = !!publicKey && publicKey === admin;
  const isContributor = contribution > BigInt(0);

  const handleAction = async (action: () => Promise<string>, successMsg: string) => {
    setIsPending(true);
    try {
      await action();
      showSuccess(successMsg);
      if (onActionSuccess) onActionSuccess();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsPending(false);
    }
  };

  if (!isWalletConnected) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 text-center">
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">Connect your wallet to interact with this campaign.</p>
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          A platform fee of {basisPointsToPercentage(platformFeeBps)} is deducted from funds when withdrawn by the creator.
        </p>
        <button
          onClick={connectWallet}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transition-colors"
        >
          Connect Wallet to Contribute
        </button>
      </div>
    );
  }

  const isExpired = Math.floor(Date.now() / 1000) > campaign.deadline;
  const contributionDisabledReason = isCreator
    ? 'Creators cannot contribute to their own campaign.'
    : campaign.is_cancelled
      ? 'This campaign has been cancelled.'
      : !campaign.is_active || campaign.funds_withdrawn || isExpired
        ? 'This campaign is no longer accepting contributions.'
        : null;

  const handleContribute = async () => {
    const parsedAmount = Number(contributionAmount);
    if (!publicKey) { showWarning('Connect your wallet to contribute.'); return; }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { showWarning('Enter a contribution amount greater than 0 XLM.'); return; }
    if (contributionDisabledReason) { showWarning(contributionDisabledReason); return; }
    setIsPending(true);
    try {
      await contribute(campaign.id, publicKey, xlmToStroops(parsedAmount));
      setContributionAmount('');
      showSuccess('Contribution submitted successfully.');
      onActionSuccess?.();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {!isCreator && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Support this cause</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            A platform fee of {basisPointsToPercentage(platformFeeBps)} is deducted from funds when withdrawn by the creator.
          </p>
          <div className="flex flex-col gap-3">
            <label className="text-sm text-zinc-700 dark:text-zinc-300" htmlFor="contribution-amount">
              Contribution amount
            </label>
            <div className="flex gap-3">
              <input
                id="contribution-amount"
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                placeholder="Amount in XLM"
                disabled={isPending || !!contributionDisabledReason}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 outline-none transition focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                onClick={handleContribute}
                disabled={isPending || !!contributionDisabledReason}
                className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400 flex items-center gap-2"
              >
                {isPending && <Spinner />}
                {isPending ? 'Processing…' : 'Contribute'}
              </button>
            </div>
            {contributionDisabledReason ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{contributionDisabledReason}</p>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Contributions are made in XLM and recorded on-chain after wallet confirmation.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Creator Actions */}
      {isCreator && (
        <>
          <WithdrawFunds
            campaign={campaign}
            userWalletAddress={publicKey}
            platformFeeBps={platformFeeBps}
            onWithdrawSuccess={onActionSuccess}
          />
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Creator Dashboard</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleAction(() => cancelCampaign(campaign.id), 'Campaign cancelled.')}
                disabled={isPending || !campaign.is_active || campaign.is_cancelled || campaign.funds_withdrawn}
                className="w-full py-3 min-h-[44px] bg-red-600 hover:bg-red-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isPending && <Spinner />} Cancel Campaign
              </button>
            </div>
          </div>
        </>
      )}

      {/* Admin Actions */}
      {isAdmin && !campaign.is_verified && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-blue-600 mb-4">Admin Panel</h3>
          <button
            onClick={() => handleAction(() => verifyCampaign(campaign.id), 'Campaign verified!')}
            disabled={isPending}
            className="w-full py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isPending && <Spinner />} Verify Campaign
          </button>
        </div>
      )}

      {/* Contributor Actions */}
      {isContributor && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Your Contribution</h3>
          <p className="text-2xl font-bold text-blue-600 mb-4">{stroopsToXlm(contribution)} XLM</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleAction(() => claimRefund(campaign.id, publicKey!), 'Refund claimed!')}
              disabled={isPending || (campaign.is_active && !isExpired)}
              title={campaign.is_active && !isExpired ? 'Cannot refund while active' : ''}
              className="w-full py-3 min-h-[44px] bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isPending && <Spinner />} Claim Refund
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
