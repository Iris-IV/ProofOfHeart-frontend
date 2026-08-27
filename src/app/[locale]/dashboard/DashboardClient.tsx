"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import MyContributionsSection from "@/components/MyContributionsSection";
import TransactionHistorySection from "@/components/TransactionHistorySection";
import { Spinner, DashboardSkeleton } from "@/components/Skeleton";
import CreatorDashboard from "@/components/CreatorDashboard";
import { useWallet } from "@/components/WalletContext";
import { Tabs, TabPanel, Card } from "@/components/ui";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useStellarBalance } from "@/hooks/useStellarBalance";
import { useSavedCampaigns } from "@/hooks/useSavedCampaigns";
import { isSameAddress } from "@/lib/stellar";
import { useEffect } from "react";
import { scheduleExpiryChecks } from "@/lib/campaignExpiryNotifier";
import { useToast } from "@/components/ToastProvider";

// Pulls in the contract client and the proposal store; only creators with a
// funded campaign ever open this tab, so keep it out of the dashboard bundle.
const MultiSigWithdrawalPanel = dynamic(() => import("@/components/MultiSigWithdrawalPanel"), {
  ssr: false,
});

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { publicKey, isWalletConnected } = useWallet();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();
  const { showWarning } = useToast();

  useEffect(() => {
    if (campaigns.length === 0 || !publicKey) return;
    const creatorCampaigns = campaigns.filter((c) => isSameAddress(c.creator, publicKey));
    if (creatorCampaigns.length === 0) return;
    return scheduleExpiryChecks(creatorCampaigns, (c) => {
      showWarning(`Campaign "${c.title}" expires in under 48 hours — consider extending the deadline.`);
    });
  }, [campaigns, publicKey, showWarning]);
  const {
    balance,
    isLoading: balanceLoading,
    error: balanceQueryError,
  } = useStellarBalance(publicKey);
  const balanceError = balanceQueryError ? t("balanceFetchError") : null;
  const { savedIds } = useSavedCampaigns();

  const [activeTab, setActiveTab] = useState<
    "overview" | "contributions" | "history" | "withdrawals" | "creator"
  >("overview");

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

  const tabs: Array<{ id: typeof activeTab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "contributions", label: "My Contributions" },
    { id: "history", label: "Transaction History" },
    { id: "withdrawals", label: t("withdrawalsTab"), count: submittedCampaigns.length },
    { id: "creator", label: "Creator Dashboard" },
  ];

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

      {/* Tab navigation */}
      <Tabs
        tabs={tabs}
        activeId={activeTab}
        onChange={setActiveTab}
        label="Dashboard sections"
        idPrefix="dashboard"
        className="mb-8"
      />

      {/* Overview tab */}
      <TabPanel tabId="overview" idPrefix="dashboard" active={activeTab === "overview"}>
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
      </TabPanel>

      {/* Contributions tab */}
      <TabPanel tabId="contributions" idPrefix="dashboard" active={activeTab === "contributions"}>
        <MyContributionsSection walletAddress={publicKey} />
      </TabPanel>

      {/* Transaction History tab */}
      <TabPanel tabId="history" idPrefix="dashboard" active={activeTab === "history"}>
        <TransactionHistorySection walletAddress={publicKey} campaignTitleMap={campaignTitleMap} />
      </TabPanel>

      {/* Withdrawals tab — multi-signature approvals for campaigns you run */}
      <TabPanel tabId="withdrawals" idPrefix="dashboard" active={activeTab === "withdrawals"}>
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">{t("withdrawalsHeading")}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("withdrawalsDescription")}
            </p>
          </div>

          {submittedCampaigns.length === 0 ? (
            <span className="text-zinc-500 dark:text-zinc-400">{t("noSubmittedCampaigns")}</span>
          ) : (
            submittedCampaigns.map((campaign) => (
              <Card key={campaign.id} padding="sm" className="bg-zinc-50 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/causes/${campaign.id}`}
                    className="font-medium text-zinc-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {campaign.title}
                  </Link>
                </div>

                {/* The panel renders nothing unless the campaign is funded and
                    not yet withdrawn, so campaigns that cannot pay out stay
                    listed but quiet. */}
                <MultiSigWithdrawalPanel campaign={campaign} walletAddress={publicKey} />
              </Card>
            ))
          )}
        </section>
      </TabPanel>

      <TabPanel tabId="creator" idPrefix="dashboard" active={activeTab === "creator"}>
        <CreatorDashboard campaigns={campaigns} creatorAddress={publicKey ?? ""} />
      </TabPanel>
    </div>
  );
}
