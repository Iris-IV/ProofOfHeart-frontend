"use client";

import { memo, useState } from "react";
import LazyImage from "./LazyImage";
import { Bookmark } from "lucide-react";
import { useLocale } from "next-intl";
import { formatAddress } from "@/lib/formatAddress";
import { formatShortDate } from "@/lib/formatters";
import { getAsyncActionErrorMessage, withActionTimeout } from "@/utils/asyncAction";
import { parseContractError } from "@/utils/contractErrors";
import { Campaign, Vote, CATEGORY_LABELS, calculateFundingPercentage } from "../types";
import Amount from "./Amount";
import CampaignCurrencySelector from "./CampaignCurrencySelector";
import AsyncButtonContent from "./AsyncButtonContent";
import CampaignDescription from "./CampaignDescription";
import CampaignStatusBadge from "./CampaignStatusBadge";
import CancelCampaignModal from "./cancelCampaignModal";
import DeadlineCountdown from "./DeadlineCountdown";
import FundingProgressBar from "./FundingProgressBar";
import { useToast } from "./ToastProvider";
import VotingComponent from "./VotingComponent";
import { useSavedCampaigns } from "@/hooks/useSavedCampaigns";
import { useCardTilt } from "@/hooks/useCardTilt";

interface CauseCardProps {
  priority?: boolean;
  campaign: Campaign;
  userWalletAddress: string | null;
  onVote: (campaignId: number, voteType: "upvote" | "downvote") => Promise<void>;
  onCancel: (campaignId: number) => Promise<void>;
  onClaimRefund: (campaignId: number) => Promise<void>;
  onTagClick?: (tag: string) => void;
  userVote?: Vote;
  upvotes?: number;
  downvotes?: number;
  totalVotes?: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  environment: "🌱",
  education: "📚",
  healthcare: "🏥",
};

function formatDate(ts: number, locale: string) {
  return formatShortDate(ts, locale);
}

function CauseCard({
  campaign,
  userWalletAddress,
  onVote,
  onCancel,
  onClaimRefund,
  userVote,
  upvotes = 0,
  downvotes = 0,
  totalVotes = 0,
}: CauseCardProps) {
  const [isVoting, setIsVoting] = useState(false);
  const locale = useLocale();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isClaimingRefund, setIsClaimingRefund] = useState(false);
  const { showError, showWarning } = useToast();
  const { isSaved, toggleSaved } = useSavedCampaigns();

  const progressPct = calculateFundingPercentage(campaign.amount_raised, campaign.funding_goal);

  const isCreator = !!userWalletAddress && userWalletAddress === campaign.creator;

  const showCancelButton =
    isCreator && campaign.status !== "cancelled" && !campaign.funds_withdrawn;

  const showClaimRefund =
    campaign.status === "cancelled" &&
    !!userWalletAddress &&
    userWalletAddress !== campaign.creator;

  const categoryLabel = CATEGORY_LABELS?.[campaign.category] ?? campaign.category;

  const categoryIcon = CATEGORY_ICONS[campaign.category] ?? "";

  const handleVote = async (_campaignId: number, voteType: "upvote" | "downvote") => {
    setIsVoting(true);
    try {
      await withActionTimeout(onVote(campaign.id, voteType));
    } catch (error) {
      showError(getAsyncActionErrorMessage(error, parseContractError));
    } finally {
      setIsVoting(false);
    }
  };

  const handleCancelConfirm = async () => {
    setIsCancelling(true);
    try {
      await withActionTimeout(onCancel(campaign.id));
      setIsCancelModalOpen(false);
    } catch (error) {
      showError(getAsyncActionErrorMessage(error, parseContractError));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleClaimRefund = async () => {
    setIsClaimingRefund(true);
    try {
      await withActionTimeout(onClaimRefund(campaign.id));
    } catch (error) {
      showError(getAsyncActionErrorMessage(error, parseContractError));
    } finally {
      setIsClaimingRefund(false);
    }
  };

  const tilt = useCardTilt();

  return (
    <article
      {...tilt}
      className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/90 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.34)] transition-all duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_26px_70px_-28px_rgba(249,115,22,0.28)] dark:border-zinc-700/80 dark:from-zinc-800 dark:to-zinc-900/90 dark:hover:border-orange-800/70">
      {/* ── Cover image ── */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-100 dark:bg-zinc-700">
        {campaign.cover_image_url ? (
          <LazyImage
            src={campaign.cover_image_url}
            alt={campaign.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl select-none">
            {categoryIcon || "💡"}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 via-transparent to-white/5" />
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!userWalletAddress) {
              showWarning("Please connect your wallet to save campaigns.");
              return;
            }
            toggleSaved(campaign.id);
          }}
          className="absolute right-2.5 top-2.5 rounded-full border border-white/60 bg-white/75 p-2 text-zinc-700 shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/75 dark:text-zinc-200 dark:hover:bg-zinc-900"
          title={isSaved(campaign.id) ? "Remove from saved" : "Save campaign"}
        >
          <Bookmark
            className={`h-5 w-5 ${isSaved(campaign.id) ? "text-orange-500" : ""}`}
            fill={isSaved(campaign.id) ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* ── Card body ── */}
      <div className="p-5 flex-1 space-y-3">
        {/* Category + status */}
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {categoryIcon} {categoryLabel}
          </span>
          <CampaignStatusBadge campaign={campaign} />
        </div>

        {/* Title */}
        <h3 className="h-12 line-clamp-2 wrap-break-word font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          {campaign.title}
        </h3>

        {/* Description */}
        <CampaignDescription description={campaign.description} />

        {/* Funding progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              <Amount value={campaign.amount_raised} maximumFractionDigits={2} /> XLM raised
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <CampaignCurrencySelector goal={campaign.funding_goal} />
        </div>

        {/* Funding progress */}
        {campaign.funding_goal > BigInt(0) && (
          <FundingProgressBar
            amountRaised={campaign.amount_raised}
            fundingGoal={campaign.funding_goal}
            milestones={campaign.milestones}
          />
        )}

        {/* Creator + deadline */}
        <div className="flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span title={campaign.creator}>
            By {formatAddress(campaign.creator)}
            {isCreator && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                You
              </span>
            )}
          </span>
          <DeadlineCountdown deadline={campaign.deadline} />
        </div>

        {/* Created date (the contract does not store one, so it may be unknown) */}
        {campaign.created_at !== undefined && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Created {formatDate(campaign.created_at, locale)}
          </p>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="px-5 pb-5 space-y-3">
        {/* Voting — hidden when cancelled */}
        {campaign.status !== "cancelled" && (
          <VotingComponent
            campaign={campaign}
            userVote={userVote}
            isVoting={isVoting}
            onVote={handleVote}
            userWalletAddress={userWalletAddress}
            upvotes={upvotes}
            downvotes={downvotes}
            totalVotes={totalVotes}
          />
        )}

        {/* Cancelled banner */}
        {campaign.status === "cancelled" && (
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-600 px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
            This campaign has been cancelled.
          </div>
        )}

        {/* Claim Refund — contributors only, after cancellation */}
        {showClaimRefund && (
          <button
            type="button"
            onClick={() => void handleClaimRefund()}
            disabled={isClaimingRefund}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <AsyncButtonContent
              isPending={isClaimingRefund}
              idleLabel="↩ Claim Refund"
              pendingLabel="Claiming refund..."
              spinnerClassName="h-3.5 w-3.5"
            />
          </button>
        )}

        {/* Cancel — creator only, while still possible */}
        {showCancelButton && (
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="w-full min-h-[44px] py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Cancel Campaign
          </button>
        )}
      </div>

      {/* Confirmation modal */}
      <CancelCampaignModal
        campaignTitle={campaign.title}
        isOpen={isCancelModalOpen}
        isCancelling={isCancelling}
        onConfirm={handleCancelConfirm}
        onClose={() => setIsCancelModalOpen(false)}
      />
    </article>
  );
}

/**
 * Memoized so a list of cards does not re-render wholesale when unrelated
 * global state changes (#648). Cards are rendered in long lists, so this is
 * where an unnecessary render is most expensive.
 */
function causeCardPropsAreEqual(prev: CauseCardProps, next: CauseCardProps): boolean {
  const prevCampaign = prev.campaign;
  const nextCampaign = next.campaign;

  return (
    prev.priority === next.priority &&
    prev.userWalletAddress === next.userWalletAddress &&
    prev.userVote === next.userVote &&
    prev.upvotes === next.upvotes &&
    prev.downvotes === next.downvotes &&
    prev.totalVotes === next.totalVotes &&
    prev.onVote === next.onVote &&
    prev.onCancel === next.onCancel &&
    prev.onClaimRefund === next.onClaimRefund &&
    prev.onTagClick === next.onTagClick &&
    prevCampaign.id === nextCampaign.id &&
    prevCampaign.status === nextCampaign.status &&
    prevCampaign.title === nextCampaign.title &&
    prevCampaign.amount_raised === nextCampaign.amount_raised &&
    prevCampaign.funding_goal === nextCampaign.funding_goal &&
    prevCampaign.deadline === nextCampaign.deadline &&
    prevCampaign.funds_withdrawn === nextCampaign.funds_withdrawn &&
    prevCampaign.cover_image_url === nextCampaign.cover_image_url
  );
}

export default memo(CauseCard, causeCardPropsAreEqual);
