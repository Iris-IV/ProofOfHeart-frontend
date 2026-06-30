"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import React, { useMemo, useState } from "react";
import MyContributionsSection from "@/components/MyContributionsSection";
import { Spinner, DashboardSkeleton } from "@/components/Skeleton";
import { useWallet } from "@/components/WalletContext";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useStellarBalance } from "@/hooks/useStellarBalance";
import { useSavedCampaigns } from "@/hooks/useSavedCampaigns";
import { isSameAddress } from "@/lib/stellar";
import { explorerTxUrl } from "@/utils/explorer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const { publicKey, isWalletConnected, signAndSubmit } = useWallet();
  const { campaigns, isLoading: campaignsLoading } = useCampaigns();
  const {
    balance,
    isLoading: balanceLoading,
    error: balanceQueryError,
  } = useStellarBalance(publicKey);

  const [claimableRevenue, setClaimableRevenue] = useState(0);
  const [isClaiming, setIsClaiming] = useState(false);

  const balanceError = balanceQueryError ? t("balanceFetchError") : null;
  const { savedIds } = useSavedCampaigns();

  const savedCampaigns = useMemo(
    () => campaigns.filter((c) => savedIds.includes(c.id)),
    [campaigns, savedIds]
  );

  const submittedCampaigns = useMemo(
    () => campaigns.filter((c) => isSameAddress(c.creator, publicKey)),
    [campaigns, publicKey]
  );

  // Fetch claimable revenue (replace with real API later)
  React.useEffect(() => {
    if (!publicKey) return;
    setClaimableRevenue(42.5); // Mock data - replace with real fetch
  }, [publicKey]);

  const handleClaimRevenue = async () => {
    if (claimableRevenue <= 0 || !publicKey) return;

    setIsClaiming(true);
    try {
      const tx = await signAndSubmit({
        contractId: "YOUR_CONTRACT_ID_HERE", // ← Update this
        method: "claim_creator_revenue",
        params: { contributor: publicKey },
      });

      if (tx) {
        toast.success(`Successfully claimed ${claimableRevenue} XLM!`);
        setClaimableRevenue(0);
      }
    } catch (err) {
      toast.error("Failed to claim revenue. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

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

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8">{t("title")}</h1>

      {/* Wallet Balance */}
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

      {/* Revenue Claiming Section */}
      <Card className="mb-8 border-emerald-500/30 bg-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-400">
            💰 Creator Revenue Sharing
          </CardTitle>
          <CardDescription>
            Claim your portion of revenue from EducationalStartup campaigns you supported
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold text-emerald-400">
              {claimableRevenue.toFixed(2)}
            </span>
            <span className="text-2xl text-emerald-400/70">XLM</span>
          </div>

          <Button
            onClick={handleClaimRevenue}
            disabled={claimableRevenue <= 0 || isClaiming}
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {isClaiming ? "Claiming..." : "Claim Revenue Now"}
          </Button>
        </CardContent>
      </Card>

      {/* Saved Campaigns */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Saved Campaigns</h2>
        {savedCampaigns.length === 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400">
            You haven't saved any campaigns yet.
          </span>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/causes/${campaign.id}`}
                className="border rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-50">{campaign.title}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 break-words">
                  {campaign.description}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Submitted Campaigns */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">{t("submittedCampaigns")}</h2>
        {submittedCampaigns.length === 0 ? (
          <span className="text-zinc-500 dark:text-zinc-400">{t("noSubmittedCampaigns")}</span>
        ) : (
          <ul className="space-y-2">
            {submittedCampaigns.map((campaign) => (
              <li
                key={campaign.id}
                className="