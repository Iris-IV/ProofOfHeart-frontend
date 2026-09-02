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
    <section aria-labelledby="trending-causes-heading" className="mt-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
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
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors self-start sm:self-auto"
        >
          <span>View all causes</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
