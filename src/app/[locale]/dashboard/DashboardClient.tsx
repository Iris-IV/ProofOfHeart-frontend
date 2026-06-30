"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import MyContributionsSection from "@/components/MyContributionsSection";
import TransactionHistorySection from "@/components/TransactionHistorySection";
import { Spinner, DashboardSkeleton } from "@/components/Skeleton";
import { useWallet } from "@/components/WalletContext";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useStellarBalance } from "@/hooks/useStellarBalance";
import { useSavedCampaigns } from "@/hooks/useSavedCampaigns";
import { isSameAddress } from "@/lib/stellar";

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { publicKey, isWalletConnected } = useWallet();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();
  const {
    balance,
    isLoading: balanceLoading,
    error: balanceQueryError,
  } = useStellarBalance(publicKey);
  const balanceError = balanceQueryError ? t("balanceFetchError") : null;
  const { savedIds } = useSavedCampaigns();

  const [activeTab, setActiveTab] = useState<"overview" | "contributions" | "history">("overview");

  const savedCampaigns = useMemo(
    () => campaigns.filter((c) => savedIds.includes(c.id)),
    [campaigns, savedIds],
  );

  const submittedCampaigns = useMemo(
    () => campaigns.filter((c) => isSameAddress(c.creator, publicKey)),
    [campaigns, publicKey],
  );

  const campaignTitleMap = useMemo(
    () => Object.fromEntries(campaigns.map((c) => [c.id, c.title])),
    [campaigns],
  );

  if (!isWalletConnected || !publicKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <h1 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
          {t("noWalletHeading")}
        </h1>
        <Link
          href="/"
          className="px-6 py-3 min-h-[44px] inline-flex items-center bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
        >
          {t("goHome")}
        </Link>
      </div>
    );
  }

  if (campaignsLoading || balanceLoading) {
    return <DashboardSkeleton />;
  }

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "contributions", label: "My Contributions" },
    { id: "history", label: "Transaction History" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

      {/* Tab navigation */}
      <div
        className="flex gap-1 mb-8 border-b border-zinc-200 dark:border-zinc-700"
        role="tablist"
        aria-label="Dashboard sections"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div role="tabpanel" id="tabpanel-overview" aria-label="Overview">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-2">{t("walletBalance")}</h2>
            {balanceLoading ? (
              <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <Spinner className="h-4 w-4 text-blue-500" /> {t("loadingBalance")}
              </span>
            ) : balanceError ? (
              <span className="text-red-500">{balanceError}</span>
            ) : (
              <span className="text-zinc-900 dark:text-zinc-50 font-mono">{balance} XLM</span>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Saved Campaigns</h2>
            {savedCampaigns.length === 0 ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                You haven&apos;t saved any campaigns yet.
              </span>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {savedCampaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/causes/${campaign.id}`}
                    className="border rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {campaign.title}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 break-words">
                      {campaign.description}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-2">{t("submittedCampaigns")}</h2>
            {submittedCampaigns.length === 0 ? (
              <span className="text-zinc-500 dark:text-zinc-400">{t("noSubmittedCampaigns")}</span>
            ) : (
              <ul className="space-y-2">
                {submittedCampaigns.map((campaign) => (
                  <li
                    key={campaign.id}
                    className="border rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900 min-h-[60px]"
                  >
                    <Link
                      href={`/causes/${campaign.id}`}
                      className="font-medium text-zinc-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {campaign.title}
                    </Link>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {campaign.description}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Contributions tab */}
      {activeTab === "contributions" && (
        <div role="tabpanel" id="tabpanel-contributions" aria-label="My Contributions">
          <MyContributionsSection walletAddress={publicKey} />
        </div>
      )}

      {/* Transaction History tab */}
      {activeTab === "history" && (
        <div role="tabpanel" id="tabpanel-history" aria-label="Transaction History">
          <TransactionHistorySection
            walletAddress={publicKey}
            campaignTitleMap={campaignTitleMap}
          />
        </div>
      )}
    </div>
  );
}
