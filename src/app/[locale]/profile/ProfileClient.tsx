"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Wallet } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useWallet } from "@/components/WalletContext";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useContributions } from "@/hooks/useContributions";
import { useSavedCampaigns } from "@/hooks/useSavedCampaigns";
import { formatAddress } from "@/lib/formatAddress";
import { formatAmount } from "@/lib/formatters";
import { isSameAddress } from "@/lib/stellar";
import { Skeleton } from "@/components/Skeleton";
import CampaignEmptyState from "@/components/CampaignEmptyState";
import { Button } from "@/components/ui";

export default function ProfileClient() {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const { publicKey, isWalletConnected, connectWallet, isLoading: walletLoading } = useWallet();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();
  const { contributions, isLoading: contributionsLoading } = useContributions(publicKey);
  const {
    savedIds, localBookmarks, syncLocalBookmarks, isSyncing,
    isLoading: savedLoading, error: savedError, refetch: refetchSaved,
  } = useSavedCampaigns();

  const savedCampaigns = useMemo(
    () => campaigns.filter((c) => savedIds.includes(c.id)),
    [campaigns, savedIds],
  );

  const createdCampaigns = useMemo(
    () => campaigns.filter((c) => isSameAddress(c.creator, publicKey)),
    [campaigns, publicKey],
  );

  const totalContributed = useMemo(
    () => contributions.reduce((sum, item) => sum + item.contribution, 0n),
    [contributions],
  );

  if (!isWalletConnected || !publicKey) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-zinc-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            {t("noWallet")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
            {t("noWalletSub")}
          </p>
        </div>
        <button
          onClick={connectWallet}
          disabled={walletLoading}
          className="px-8 py-3 rounded-full bg-linear-to-r from-red-500 to-pink-600 text-white font-bold hover:from-red-600 hover:to-pink-700 transition-all shadow-lg shadow-red-500/25 disabled:opacity-50"
        >
          {walletLoading ? t("connecting") : t("connectWallet")}
        </button>
      </div>
    );
  }

  const isDataLoading = campaignsLoading || contributionsLoading;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Profile header */}
      <div className="rounded-3xl bg-linear-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-700 p-8 mb-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="w-16 h-16 shrink-0 rounded-full bg-linear-to-br from-red-400 to-pink-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
            {publicKey.slice(1, 3).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
              {t("walletAddress")}
            </p>
            <p className="font-mono text-zinc-100 text-sm break-all" title={publicKey}>
              {publicKey}
            </p>
          </div>
        </div>

        {/* Impact stats */}
        <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-zinc-700">
          <div className="text-center">
            {isDataLoading ? (
              <Skeleton className="h-7 w-24 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-black text-white">
                {formatAmount(totalContributed, locale, { maximumFractionDigits: 2 })}
                <span className="text-sm font-bold text-zinc-400 ml-1">XLM</span>
              </p>
            )}
            <p className="text-xs text-zinc-400 font-medium mt-1">{t("totalContributed")}</p>
          </div>
          <div className="text-center">
            {isDataLoading ? (
              <Skeleton className="h-7 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-black text-white">{contributions.length}</p>
            )}
            <p className="text-xs text-zinc-400 font-medium mt-1">{t("campaignsBacked")}</p>
          </div>
          <div className="text-center">
            {isDataLoading ? (
              <Skeleton className="h-7 w-12 mx-auto mb-1" />
            ) : (
              <p className="text-2xl font-black text-white">{createdCampaigns.length}</p>
            )}
            <p className="text-xs text-zinc-400 font-medium mt-1">{t("campaignsCreated")}</p>
          </div>
        </div>
      </div>

      {/* Contributions */}
      {(isDataLoading || contributions.length > 0) && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
            {t("campaignsBacked")}
          </h2>
          {isDataLoading ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : (
            <ul className="space-y-3">
              {contributions.map((item, index) => {
                const campaign = item.campaign;
                return (
                  <li key={`${campaign.id}-${index}`}>
                    <Link
                      href={`/causes/${campaign.id}`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-red-200 dark:hover:border-red-900/40 hover:shadow-md transition-all"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-1">
                          {campaign.title}
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 font-medium">
                          {formatAddress(campaign.creator)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        {formatAmount(item.contribution, locale, { maximumFractionDigits: 2 })}
                        <span className="text-xs font-semibold text-zinc-400 ml-1">XLM</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Saved campaigns */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
          {t("savedCampaigns")}
        </h2>
        {localBookmarks.length > 0 && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900/50 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-blue-900 dark:text-blue-200">
              You have {localBookmarks.length} bookmark{localBookmarks.length === 1 ? "" : "s"}{" "}
              saved only in this browser. Move them to your wallet so they follow you across
              devices.
            </p>
            <button
              type="button"
              onClick={syncLocalBookmarks}
              disabled={isSyncing}
              className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isSyncing
                ? "Syncing..."
                : `Sync ${localBookmarks.length} local bookmark${localBookmarks.length === 1 ? "" : "s"} to your wallet`}
            </button>
          </div>
        )}
        {savedError ? (
          <div role="alert" className="rounded-surface border border-danger p-4 text-danger">
            <p>{t("savedLoadError")}</p>
            <Button variant="secondary" onClick={() => { void refetchSaved(); }}>{t("retrySaved")}</Button>
          </div>
        ) : campaignsLoading || savedLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : savedCampaigns.length === 0 ? (
          <CampaignEmptyState
            variant="bookmarks"
            title={t("noSavedCampaigns")}
            description={t("saveCampaignHint")}
            action={<Link
              href="/explore"
              className="tap-target focus-ring inline-flex items-center rounded-control bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors duration-[120ms] hover:bg-brand-strong motion-reduce:transition-none"
            >
              {t("browseCauses")}
            </Link>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/causes/${campaign.id}`}
                className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-red-200 dark:hover:border-red-900/40 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800"
              >
                <p className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-1">
                  {campaign.title}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                  {campaign.description}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 font-medium">
                  by {formatAddress(campaign.creator)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Created campaigns */}
      {(createdCampaigns.length > 0 || campaignsLoading) && (
        <section>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
            {t("createdCampaigns")}
          </h2>
          {campaignsLoading ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : (
            <ul className="space-y-3">
              {createdCampaigns.map((campaign) => (
                <li key={campaign.id}>
                  <Link
                    href={`/causes/${campaign.id}`}
                    className="group flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-red-200 dark:hover:border-red-900/40 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-800"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-1">
                        {campaign.title}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                        {campaign.description}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 capitalize">
                      {campaign.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
