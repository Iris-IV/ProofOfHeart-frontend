'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as StellarSdk from '@stellar/stellar-sdk';
import { useWallet } from '@/components/WalletContext';
import { useToast } from '@/components/ToastProvider';
import { useCampaigns } from '@/hooks/useCampaigns';
import {
  getPlatformFee,
  updateAdmin,
  updatePlatformFee,
  verifyCampaign,
} from '@/lib/contractClient';
import { basisPointsToPercentage, stroopsToXlm } from '@/types';
import { parseContractError } from '@/utils/contractErrors';

interface AdminDashboardClientProps {
  initialAdminAddress: string | null;
  initialPlatformFee: number | null;
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeAddress(address: string | null | undefined) {
  return address?.trim().toUpperCase() ?? '';
}

export default function AdminDashboardClient({
  initialAdminAddress,
  initialPlatformFee,
}: AdminDashboardClientProps) {
  const { publicKey, isWalletConnected, connectWallet, isLoading: isWalletLoading } = useWallet();
  const { campaigns, isLoading, error, refetch, isRefreshing } = useCampaigns();
  const { showError, showInfo, showSuccess, showWarning } = useToast();

  const [adminAddress, setAdminAddress] = useState(initialAdminAddress ?? '');
  const [platformFee, setPlatformFee] = useState<number | null>(initialPlatformFee);
  const [feeInput, setFeeInput] = useState(
    initialPlatformFee !== null ? String(initialPlatformFee) : '',
  );
  const [newAdminInput, setNewAdminInput] = useState('');
  const [isFeeLoading, setIsFeeLoading] = useState(initialPlatformFee === null);
  const [verifyingCampaignId, setVerifyingCampaignId] = useState<number | null>(null);
  const [isUpdatingFee, setIsUpdatingFee] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPlatformFee()
      .then((fee) => {
        if (cancelled) return;
        setPlatformFee(fee);
        setFeeInput(String(fee));
      })
      .catch((err) => {
        if (!cancelled) {
          showError(err instanceof Error ? err.message : 'Failed to load platform fee.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsFeeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showError]);

  const isAdmin = useMemo(() => {
    return normalizeAddress(publicKey) !== '' && normalizeAddress(publicKey) === normalizeAddress(adminAddress);
  }, [adminAddress, publicKey]);

  const unverifiedCampaigns = useMemo(() => {
    return campaigns
      .filter((campaign) => !campaign.is_verified)
      .sort((left, right) => left.id - right.id);
  }, [campaigns]);

  const totalRaised = useMemo(() => {
    return campaigns.reduce((sum, campaign) => sum + campaign.amount_raised, BigInt(0));
  }, [campaigns]);

  const activeCampaignCount = useMemo(() => {
    return campaigns.filter((campaign) => campaign.is_active && !campaign.is_cancelled).length;
  }, [campaigns]);

  const handleVerifyCampaign = async (campaignId: number) => {
    if (!isAdmin) {
      showWarning('Only the connected admin wallet can verify campaigns.');
      return;
    }

    setVerifyingCampaignId(campaignId);
    showInfo('Freighter will ask you to confirm campaign verification.');

    try {
      const txHash = await verifyCampaign(campaignId);
      showSuccess(`Campaign verified. Tx: ${txHash.slice(0, 10)}…`);
      refetch();
    } catch (error) {
      showError(parseContractError(error));
    } finally {
      setVerifyingCampaignId(null);
    }
  };

  const handleUpdateFee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      showWarning('Only the connected admin wallet can update the platform fee.');
      return;
    }

    const parsedFee = Number(feeInput);
    if (!Number.isInteger(parsedFee) || parsedFee < 0 || parsedFee > 10_000) {
      showError('Enter a valid platform fee in basis points between 0 and 10000.');
      return;
    }

    setIsUpdatingFee(true);
    showInfo('Freighter will ask you to confirm the platform fee update.');

    try {
      const txHash = await updatePlatformFee(parsedFee);
      setPlatformFee(parsedFee);
      setFeeInput(String(parsedFee));
      showSuccess(`Platform fee updated. Tx: ${txHash.slice(0, 10)}…`);
    } catch (error) {
      showError(parseContractError(error));
    } finally {
      setIsUpdatingFee(false);
    }
  };

  const handleTransferAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      showWarning('Only the connected admin wallet can transfer admin access.');
      return;
    }

    const nextAdmin = newAdminInput.trim();
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(nextAdmin)) {
      showError('Enter a valid Stellar public key for the new admin.');
      return;
    }

    setIsUpdatingAdmin(true);
    showInfo('Freighter will ask you to confirm the admin transfer.');

    try {
      const txHash = await updateAdmin(nextAdmin);
      setAdminAddress(nextAdmin);
      setNewAdminInput('');
      showSuccess(`Admin transferred. Tx: ${txHash.slice(0, 10)}…`);
    } catch (error) {
      showError(parseContractError(error));
    } finally {
      setIsUpdatingAdmin(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
        <section className="overflow-hidden rounded-3xl border border-amber-200/70 bg-white/85 p-8 shadow-[0_24px_80px_-32px_rgba(217,119,6,0.45)] backdrop-blur dark:border-amber-500/20 dark:bg-zinc-900/85">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                Admin Console
              </span>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
                  Campaign verification and platform controls
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400 sm:text-base">
                  Review pending campaigns, update the platform fee, and transfer admin rights. Every on-chain change requires a wallet signature from the current admin.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">Contract admin</div>
              <div className="mt-2 break-all font-mono text-xs sm:text-sm">
                {adminAddress || 'Unavailable'}
              </div>
            </div>
          </div>
        </section>

        {!isWalletConnected || !publicKey ? (
          <section className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Wallet connection required</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Connect the admin wallet to unlock platform management actions.
            </p>
            <button
              type="button"
              onClick={connectWallet}
              disabled={isWalletLoading}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300"
            >
              {isWalletLoading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </section>
        ) : !isAdmin ? (
          <section className="rounded-3xl border border-red-200 bg-red-50/80 p-8 shadow-sm dark:border-red-500/30 dark:bg-red-500/10">
            <h2 className="text-2xl font-semibold text-red-950 dark:text-red-100">Unauthorized</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-red-800 dark:text-red-200">
              The connected wallet <span className="font-mono">{formatAddress(publicKey)}</span> does not match the contract admin address.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-red-300 px-5 py-3 text-sm font-semibold text-red-900 transition hover:bg-red-100 dark:border-red-400/30 dark:text-red-100 dark:hover:bg-red-500/10"
              >
                Return Home
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total campaigns</div>
                <div className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">{campaigns.length}</div>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total raised</div>
                <div className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">
                  {stroopsToXlm(totalRaised).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
                </div>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active campaigns</div>
                <div className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">{activeCampaignCount}</div>
              </div>
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Current fee</div>
                <div className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">
                  {isFeeLoading || platformFee === null ? '...' : basisPointsToPercentage(platformFee)}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Verification queue</h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Pending campaigns waiting for admin approval.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={refetch}
                    disabled={isRefreshing}
                    className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>

                {isLoading ? (
                  <div className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Loading campaigns...</div>
                ) : error ? (
                  <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                    {error}
                  </div>
                ) : unverifiedCampaigns.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    No unverified campaigns at the moment.
                  </div>
                ) : (
                  <div className="mt-6 space-y-4">
                    {unverifiedCampaigns.map((campaign) => (
                      <article
                        key={campaign.id}
                        className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/70"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                                Campaign #{campaign.id}
                              </span>
                              <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                {campaign.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{campaign.title}</h3>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                                {campaign.description}
                              </p>
                            </div>
                            <div className="grid gap-2 text-sm text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                              <div>Creator: <span className="font-mono text-xs">{campaign.creator}</span></div>
                              <div>
                                Raised: {stroopsToXlm(campaign.amount_raised).toLocaleString(undefined, { maximumFractionDigits: 2 })} / {stroopsToXlm(campaign.funding_goal).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:min-w-44">
                            <Link
                              href={`/causes/${campaign.id}`}
                              className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              Review details
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleVerifyCampaign(campaign.id)}
                              disabled={verifyingCampaignId === campaign.id}
                              className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {verifyingCampaignId === campaign.id ? 'Awaiting signature...' : 'Verify'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Platform fee</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    Current on-chain fee: {isFeeLoading || platformFee === null ? 'Loading...' : `${platformFee} bps (${basisPointsToPercentage(platformFee)})`}
                  </p>
                  <form className="mt-5 space-y-4" onSubmit={handleUpdateFee}>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Fee in basis points</span>
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={feeInput}
                        onChange={(event) => setFeeInput(event.target.value)}
                        className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-zinc-950 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-amber-500/20"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isUpdatingFee}
                      className="inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300"
                    >
                      {isUpdatingFee ? 'Awaiting signature...' : 'Update platform fee'}
                    </button>
                  </form>
                </section>

                <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Transfer admin</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    Move admin access to another Stellar address. After confirmation, the current wallet will lose access immediately.
                  </p>
                  <form className="mt-5 space-y-4" onSubmit={handleTransferAdmin}>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">New admin address</span>
                      <input
                        type="text"
                        value={newAdminInput}
                        onChange={(event) => setNewAdminInput(event.target.value)}
                        placeholder="G..."
                        className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-zinc-950 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-amber-500/20"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isUpdatingAdmin}
                      className="inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300"
                    >
                      {isUpdatingAdmin ? 'Awaiting signature...' : 'Transfer admin'}
                    </button>
                  </form>
                </section>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
