'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { claimRefund, claimRevenue } from '../lib/contractClient';
import { getStellarExplorerTxUrl } from '../lib/stellarExplorer';
import { useContributions } from '../hooks/useContributions';
import { CampaignStatus, stroopsToXlm } from '../types';
import { useToast } from './ToastProvider';
import { parseContractError } from '../utils/contractErrors';

interface MyContributionsSectionProps {
  walletAddress: string;
}

function formatXlmAmount(value: bigint): string {
  return stroopsToXlm(value).toLocaleString(undefined, {
    maximumFractionDigits: 7,
  });
}

function getStatusLabel(status: CampaignStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'funded':
      return 'Funded';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'verified':
      return 'Verified';
    default:
      return 'Unknown';
  }
}

function getStatusClasses(status: CampaignStatus): string {
  switch (status) {
    case 'active':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'funded':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'failed':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'cancelled':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  }
}

function getActionLabel(action: 'contribute' | 'claim_refund' | 'claim_revenue'): string {
  switch (action) {
    case 'contribute':
      return 'Contribution';
    case 'claim_refund':
      return 'Refund claim';
    case 'claim_revenue':
      return 'Revenue claim';
    default:
      return 'Transaction';
  }
}

export default function MyContributionsSection({ walletAddress }: MyContributionsSectionProps) {
  const { showError, showSuccess } = useToast();
  const [pendingCampaignId, setPendingCampaignId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<'refund' | 'revenue' | null>(null);
  const {
    contributions,
    isLoading,
    isRefreshing,
    error,
    refetch,
  } = useContributions(walletAddress);

  const totalContributed = useMemo(
    () => contributions.reduce((sum, item) => sum + item.contribution, BigInt(0)),
    [contributions],
  );

  const handleClaimRefund = async (campaignId: number) => {
    setPendingCampaignId(campaignId);
    setPendingAction('refund');
    try {
      await claimRefund(campaignId, walletAddress);
      showSuccess('Refund claimed successfully.');
      refetch();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setPendingCampaignId(null);
      setPendingAction(null);
    }
  };

  const handleClaimRevenue = async (campaignId: number) => {
    setPendingCampaignId(campaignId);
    setPendingAction('revenue');
    try {
      await claimRevenue(campaignId, walletAddress);
      showSuccess('Revenue claimed successfully.');
      refetch();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setPendingCampaignId(null);
      setPendingAction(null);
    }
  };

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">My Contributions</h2>
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          {contributions.length} campaign{contributions.length === 1 ? '' : 's'} contributed ·{' '}
          {formatXlmAmount(totalContributed)} XLM total
        </div>
      </div>

      {isLoading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading contribution history...</p>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : contributions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No contributions found for this wallet yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {contributions.map((item) => {
            const isPending = pendingCampaignId === item.campaign.id;
            const contributionTransactions = item.transactions.filter(
              (entry) => entry.action === 'contribute',
            );

            return (
              <li
                key={item.campaign.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">{item.campaign.title}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Contributed {formatXlmAmount(item.contribution)} XLM
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(item.status)}`}
                  >
                    {getStatusLabel(item.status)}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <Link
                    href={`/causes/${item.campaign.id}`}
                    className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Open Campaign
                  </Link>
                  {item.canClaimRefund && (
                    <button
                      onClick={() => handleClaimRefund(item.campaign.id)}
                      disabled={isPending}
                      className="inline-flex items-center rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                      {isPending && pendingAction === 'refund' ? 'Claiming...' : 'Claim Refund'}
                    </button>
                  )}
                  {item.canClaimRevenue && (
                    <button
                      onClick={() => handleClaimRevenue(item.campaign.id)}
                      disabled={isPending}
                      className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                      {isPending && pendingAction === 'revenue'
                        ? 'Claiming...'
                        : `Claim Revenue (${formatXlmAmount(item.claimableRevenue)} XLM)`}
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {contributionTransactions.length > 0 ? (
                    contributionTransactions.map((entry) => (
                      <div key={entry.txHash} className="flex items-center gap-2">
                        <span>Contribution tx:</span>
                        <a
                          href={getStellarExplorerTxUrl(entry.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {entry.txHash.slice(0, 10)}...{entry.txHash.slice(-8)}
                        </a>
                      </div>
                    ))
                  ) : (
                    <span>No contribution transaction recorded on this device yet.</span>
                  )}

                  {item.transactions.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">Transaction log</p>
                      <ul className="space-y-1">
                        {item.transactions.map((entry) => (
                          <li key={`${entry.action}-${entry.txHash}`} className="flex items-center gap-2">
                            <span>{getActionLabel(entry.action)}:</span>
                            <a
                              href={getStellarExplorerTxUrl(entry.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {entry.txHash.slice(0, 10)}...{entry.txHash.slice(-8)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isRefreshing && !isLoading && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Refreshing contribution history...</p>
      )}
    </section>
  );
}
