"use client";

import { Flame, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import CauseCard from "./CauseCard";
import { CauseCardSkeleton } from "./Skeleton";
import { useTrendingCampaigns } from "@/hooks/useTrendingCampaigns";
import { cancelCampaign, claimRefund, voteOnCampaign } from "@/lib/contractClient";
import { getAsyncActionErrorMessage, withActionTimeout } from "@/utils/asyncAction";
import { parseContractError } from "@/utils/contractErrors";
import { useToast } from "./ToastProvider";

interface TrendingCampaignsProps {
  userWalletAddress: string | null;
  limit?: number;
}

export default function TrendingCampaigns({
  userWalletAddress,
  limit = 3,
}: TrendingCampaignsProps) {
  const { trendingCampaigns, isLoading } = useTrendingCampaigns(limit);
  const { showError, showSuccess, showWarning } = useToast();

  const handleVote = async (campaignId: number, voteType: "upvote" | "downvote") => {
    if (!userWalletAddress) {
      showWarning("Please connect your wallet first.");
      return;
    }
    try {
      await withActionTimeout(voteOnCampaign(campaignId, userWalletAddress, voteType === "upvote"));
      showSuccess("Your vote has been cast.");
    } catch (error) {
      showError(getAsyncActionErrorMessage(error, parseContractError));
    }
  };

  const handleCancel = async (campaignId: number) => {
    if (!userWalletAddress) return;
    try {
      await withActionTimeout(cancelCampaign(campaignId));
      showSuccess("Campaign cancelled.");
    } catch (error) {
      showError(getAsyncActionErrorMessage(error, parseContractError));
    }
  };

  const handleClaimRefund = async (campaignId: number) => {
    if (!userWalletAddress) return;
    try {
      await withActionTimeout(claimRefund(campaignId, userWalletAddress));
      showSuccess("Refund claimed.");
    } catch (error) {
      showError(getAsyncActionErrorMessage(error, parseContractError));
    }
  };

  if (isLoading) {
    return (
      <section aria-labelledby="trending-causes-heading" className="mt-20">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Flame size={22} />
            </div>
            <div>
              <h2
                id="trending-causes-heading"
                className="text-2xl font-bold text-zinc-900 dark:text-zinc-50"
              >
                Trending Causes
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Community causes gaining high momentum
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: limit }).map((_, i) => (
            <CauseCardSkeleton key={i} />
          ))}
        </div>
      </section>
    );
  }

  if (trendingCampaigns.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="trending-causes-heading"
      className="relative mt-20 overflow-hidden rounded-[28px] border border-orange-100/80 bg-gradient-to-br from-orange-50/80 via-white to-rose-50/70 p-4 shadow-[0_20px_60px_-20px_rgba(249,115,22,0.18)] backdrop-blur-sm dark:border-orange-950/40 dark:from-zinc-900/90 dark:via-zinc-900 dark:to-orange-950/20 sm:p-6 lg:p-8"
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/80 to-transparent dark:via-orange-500/50" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 shadow-sm ring-1 ring-orange-200/80 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800/60">
            <Flame size={22} />
          </div>
          <div>
            <h2
              id="trending-causes-heading"
              className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              Trending Causes
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Community causes gaining high momentum
            </p>
          </div>
        </div>
        <Link
          href="/explore"
          className="group inline-flex items-center gap-1.5 self-start rounded-full border border-orange-200 bg-white/80 px-3.5 py-2 text-sm font-semibold text-orange-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-white hover:text-orange-700 dark:border-orange-800/70 dark:bg-zinc-900/70 dark:text-orange-300 dark:hover:border-orange-700 dark:hover:text-orange-200 sm:self-auto"
        >
          <span>View all causes</span>
          <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {trendingCampaigns.map((campaign) => (
          <CauseCard
            key={campaign.id}
            campaign={campaign}
            userWalletAddress={userWalletAddress}
            onVote={handleVote}
            onCancel={handleCancel}
            onClaimRefund={handleClaimRefund}
          />
        ))}
      </div>
    </section>
  );
}
