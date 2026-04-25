"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { explorerTxUrl } from "@/utils/explorer";
import Link from "next/link";
import { useWallet } from "@/components/WalletContext";
import { useCampaigns } from "@/hooks/useCampaigns";
import { getStellarBalance } from "@/lib/getStellarBalance";
import { DashboardSkeleton, Spinner } from "@/components/Skeleton";

import MyContributionsSection from "@/components/MyContributionsSection";

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const { publicKey, isWalletConnected } = useWallet();
  const [loading, setLoading] = useState(true);
  const { campaigns } = useCampaigns();
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const bal = await getStellarBalance(publicKey);
      setBalance(bal);
    } catch {
      setBalanceError(t('balanceFetchError'));
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    setLoading(false);
    if (publicKey) fetchBalance();
  }, [isWalletConnected, publicKey, fetchBalance]);

  const mockVotes = useMemo(() => [
    { campaignId: 1, voter: publicKey, voteType: 'upvote', timestamp: new Date('2024-02-01'), transactionHash: 'tx1' },
    { campaignId: 2, voter: publicKey, voteType: 'downvote', timestamp: new Date('2024-02-10'), transactionHash: 'tx2' },
  ], [publicKey]);

  const mockFunding = useMemo(() => [
    { campaignId: 3, amount: 100, timestamp: new Date('2024-02-15'), tx: 'fund1' },
    { campaignId: 1, amount: 50, timestamp: new Date('2024-02-20'), tx: 'fund2' },
  ], []);

  const submittedCampaigns = useMemo(() => campaigns.filter((c) => c.creator === publicKey), [campaigns, publicKey]);

  if (loading) return <DashboardSkeleton />;
  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!isWalletConnected || !publicKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">{t('noWalletHeading')}</h2>
        <Link href="/" className="px-6 py-3 min-h-[44px] inline-flex items-center bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition">{t('goHome')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">{t('walletBalance')}</h2>
        {balanceLoading ? (
          <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <Spinner className="h-4 w-4 text-blue-500" /> {t('loadingBalance')}
          </span>
        ) : balanceError ? (
          <span className="text-red-500">{balanceError}</span>
        ) : (
          <span className="text-zinc-900 dark:text-zinc-50 font-mono">{balance} XLM</span>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">{t('submittedCampaigns')}</h2>
        {submittedCampaigns.length === 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400">{t('noSubmittedCampaigns')}</span>
        ) : (
          <ul className="space-y-2">
            {submittedCampaigns.map((campaign) => (
              <li key={campaign.id} className="border rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900 min-h-[60px]">
                <div className="font-medium text-zinc-900 dark:text-zinc-50">{campaign.title}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{campaign.description}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <MyContributionsSection walletAddress={publicKey} />

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">{t('votingHistory')}</h2>
        {mockVotes.length === 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400">{t('noVotingHistory')}</span>
        ) : (
          <ul className="space-y-2">
            {mockVotes.map((vote, idx) => {
              const campaign = campaigns.find((c) => c.id === vote.campaignId);
              return (
                <li key={idx} className="border rounded p-3 bg-zinc-50 dark:bg-zinc-900">
                  <div className="font-medium">{campaign ? campaign.title : t('campaignFallback', { id: vote.campaignId })}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {vote.voteType === 'upvote'
                      ? t('upvotedOn', { date: vote.timestamp.toLocaleDateString() })
                      : t('downvotedOn', { date: vote.timestamp.toLocaleDateString() })}<br />
                    <a
                      href={explorerTxUrl(vote.transactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {t('viewOnExplorer')}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">{t('fundingHistory')}</h2>
        {mockFunding.length === 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400">{t('noFundingHistory')}</span>
        ) : (
          <ul className="space-y-2">
            {mockFunding.map((fund, idx) => {
              const campaign = campaigns.find((c) => c.id === fund.campaignId);
              return (
                <li key={idx} className="border rounded p-3 bg-zinc-50 dark:bg-zinc-900">
                  <div className="font-medium">{campaign ? campaign.title : t('campaignFallback', { id: fund.campaignId })}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {t('donated', { amount: fund.amount, date: fund.timestamp.toLocaleDateString() })}<br />
                    <a
                      href={explorerTxUrl(fund.tx)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {t('viewOnExplorer')}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )
        }
      </section>
    </div>
  );
}
