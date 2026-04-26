"use client";
"use client";
import { explorerTxUrl } from "../utils/explorer";

import { useState } from "react";
import { Campaign, basisPointsToPercentage, stroopsToXlm } from "../types";
import { withdrawFunds } from "../lib/contractClient";
import { useToast } from "./ToastProvider";
import { parseContractError } from "../utils/contractErrors";
import { isSameAddress } from "../lib/stellar";

interface WithdrawFundsProps {
  campaign: Campaign;
  userWalletAddress: string | null;
  platformFeeBps?: number; // basis points, default 300 = 3%
  onWithdrawSuccess?: () => void;
}

export default function WithdrawFunds({
  campaign,
  userWalletAddress,
  platformFeeBps = 300,
  onWithdrawSuccess,
}: WithdrawFundsProps) {
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { showError, showSuccess } = useToast();

  // Only the campaign creator should see this component
  const isCreator = isSameAddress(userWalletAddress, campaign.creator);

  if (!isCreator) return null;

  const now = Math.floor(Date.now() / 1000);
  const deadlinePassed = campaign.deadline < now;
  const goalReached = campaign.amount_raised >= campaign.funding_goal;

  // Determine if withdraw should be disabled
  const isDisabled =
    campaign.is_cancelled ||
    campaign.funds_withdrawn ||
    !goalReached ||
    (campaign.is_active && !deadlinePassed);

  const disabledReason = campaign.is_cancelled
    ? "Campaign has been cancelled"
    : campaign.funds_withdrawn
      ? "Funds have already been withdrawn"
      : !goalReached
        ? "Funding goal has not been reached"
        : campaign.is_active && !deadlinePassed
          ? "Campaign is still active"
          : null;

  // Fee breakdown
  const totalRaised = stroopsToXlm(campaign.amount_raised);
  const feeAmount = totalRaised * (platformFeeBps / 10000);
  const creatorAmount = totalRaised - feeAmount;
  const feePct = basisPointsToPercentage(platformFeeBps);

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      const hash = await withdrawFunds(campaign.id);
      setTxHash(hash);
      showSuccess(
        `Withdrawal successful! You received ${creatorAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM.`,
      );
      onWithdrawSuccess?.();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsWithdrawing(false);
      setShowConfirm(false);
    }
  };

  // Success state — show tx hash and amounts, with explorer link
  if (txHash) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-5 h-5 text-green-600 dark:text-green-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
            Withdrawal Successful
          </h3>
        </div>
        <div className="space-y-1.5 text-sm text-green-700 dark:text-green-300">
          <p>
            <span className="font-medium">Amount received:</span>{" "}
            {creatorAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
          </p>
          <p>
            <span className="font-medium">Platform fee:</span>{" "}
            {feeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
          </p>
          <p className="break-all">
            <span className="font-medium">Transaction:</span>{" "}
            <span className="font-mono text-xs">{txHash}</span>{" "}
            <a
              href={explorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
            >
              View on Explorer
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Withdraw Funds</h3>

      {/* Fee breakdown */}
      {goalReached && !campaign.funds_withdrawn && !campaign.is_cancelled && (
        <div className="mb-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>Total raised</span>
            <span>{totalRaised.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM</span>
          </div>
          <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
            <span>Platform fee ({feePct}%)</span>
            <span>-{feeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM</span>
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-600 pt-1.5 flex justify-between font-semibold text-zinc-900 dark:text-zinc-50">
            <span>You will receive</span>
            <span>{creatorAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM</span>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirm ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to withdraw? This action cannot be undone. You will withdraw{" "}
            {totalRaised.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM total, pay{" "}
            {feeAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM in platform
            fees, and receive{" "}
            {creatorAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing}
              className="flex-1 px-4 py-3 min-h-[44px] bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWithdrawing ? "Processing…" : "Confirm Withdrawal"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isWithdrawing}
              className="px-4 py-3 min-h-[44px] border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isDisabled}
            className="w-full px-4 py-3 min-h-[44px] bg-linear-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-zinc-400 disabled:to-zinc-400"
          >
            Withdraw Funds
          </button>
          {disabledReason && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 text-center">
              {disabledReason}
            </p>
          )}
        </>
      )}
    </div>
  );
}
