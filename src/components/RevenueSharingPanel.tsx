'use client';

import { FormEvent, useMemo, useState } from 'react';
import { claimRevenue, depositRevenue } from '../lib/contractClient';
import { Campaign, basisPointsToPercentage, stroopsToXlm, xlmToStroops } from '../types';
import { useWallet } from './WalletContext';
import { useRevenueSharing } from '../hooks/useRevenueSharing';
import { useToast } from './ToastProvider';
import { parseContractError } from '../utils/contractErrors';

interface RevenueSharingPanelProps {
  campaign: Campaign;
  variant?: 'detail' | 'dashboard';
  showCreatorControls?: boolean;
  showContributorControls?: boolean;
  onActionSuccess?: () => void;
}

function formatXlmAmount(value: bigint): string {
  return stroopsToXlm(value).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

export default function RevenueSharingPanel({
  campaign,
  variant = 'detail',
  showCreatorControls = true,
  showContributorControls = true,
  onActionSuccess,
}: RevenueSharingPanelProps) {
  const { publicKey, connectWallet, isWalletConnected } = useWallet();
  const { showError, showSuccess, showWarning } = useToast();
  const [depositAmount, setDepositAmount] = useState('');
  const [isPending, setIsPending] = useState(false);

  const {
    revenuePool,
    contribution,
    claimed,
    contributorShare,
    claimable,
    isLoading,
    refetch,
  } = useRevenueSharing(
    campaign.id,
    publicKey,
    campaign.amount_raised,
    campaign.has_revenue_sharing,
  );

  const isCreator = publicKey === campaign.creator;
  const canShowCreatorControls = showCreatorControls && isCreator;
  const canShowContributorControls = showContributorControls && !!publicKey;
  const hasContribution = contribution > BigInt(0);

  const breakdown = useMemo(() => {
    if (campaign.amount_raised <= BigInt(0)) {
      return 'No contributor share is available until the campaign has raised funds.';
    }

    return `${formatXlmAmount(contribution)} XLM contribution × ${formatXlmAmount(revenuePool)} XLM pool ÷ ${formatXlmAmount(campaign.amount_raised)} XLM raised = ${formatXlmAmount(contributorShare)} XLM`;
  }, [campaign.amount_raised, contribution, contributorShare, revenuePool]);

  if (!campaign.has_revenue_sharing) {
    return null;
  }

  const handleDeposit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAmount = Number(depositAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showWarning('Enter a revenue amount greater than 0 XLM.');
      return;
    }

    setIsPending(true);
    try {
      await depositRevenue(campaign.id, xlmToStroops(parsedAmount));
      setDepositAmount('');
      refetch();
      onActionSuccess?.();
      showSuccess('Revenue deposited successfully.');
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsPending(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey) {
      showWarning('Connect your wallet to claim revenue.');
      return;
    }

    setIsPending(true);
    try {
      await claimRevenue(campaign.id, publicKey);
      refetch();
      onActionSuccess?.();
      showSuccess('Revenue claimed successfully.');
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsPending(false);
    }
  };

  const containerClassName =
    variant === 'dashboard'
      ? 'rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/30'
      : 'bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-900 p-6';

  return (
    <section className={containerClassName}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Revenue Sharing</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {basisPointsToPercentage(campaign.revenue_share_percentage)} revenue sharing
          </p>
        </div>
        <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 ring-1 ring-emerald-200 dark:bg-zinc-900/80 dark:text-emerald-300 dark:ring-emerald-800">
          Eligible campaign
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total Pool</p>
          <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{formatXlmAmount(revenuePool)} XLM</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Your Share</p>
          <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{formatXlmAmount(contributorShare)} XLM</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Already Claimed</p>
          <p className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{formatXlmAmount(claimed)} XLM</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Claimable Now</p>
          <p className="mt-2 text-xl font-semibold text-emerald-700 dark:text-emerald-300">{formatXlmAmount(claimable)} XLM</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200/80 bg-white/85 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Pro-rata calculation</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{breakdown}</p>
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Refreshing revenue sharing data...</p>
      )}

      {!isWalletConnected && showContributorControls && (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          <p>Connect your wallet to view your exact contribution share and claim revenue.</p>
          <button
            onClick={connectWallet}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {canShowContributorControls && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/85 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Contributor claim</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {hasContribution
                  ? `You contributed ${formatXlmAmount(contribution)} XLM to this campaign.`
                  : 'You have not contributed to this campaign yet, so your claimable share is currently 0 XLM.'}
              </p>
            </div>
            <button
              onClick={handleClaim}
              disabled={isPending || claimable <= BigInt(0) || !hasContribution}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              Claim Revenue
            </button>
          </div>
        </div>
      )}

      {canShowCreatorControls && (
        <div className="mt-4 rounded-2xl border border-zinc-200/80 bg-white/85 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Deposit Revenue</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Add revenue back into the pool so contributors can claim their proportional share.
          </p>
          <form onSubmit={handleDeposit} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">Deposit amount in XLM</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.0000001"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                placeholder="Amount in XLM"
                className="w-full rounded-full border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-900"
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              Deposit Revenue
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
