"use client";

import React, { useState, useCallback } from "react";
import { useLocale } from "next-intl";
import { Campaign, basisPointsToPercentage, xlmToStroops } from "../types";
import { formatAmount } from "@/lib/formatters";
import AsyncButtonContent from "./AsyncButtonContent";
import { useToast } from "./ToastProvider";
import { useWallet } from "./WalletContext";
import WithdrawFunds from "./WithdrawFunds";
import { useAdmin } from "../hooks/useAdmin";
import { useContribution } from "../hooks/useContribution";
import { usePlatformFee } from "../hooks/usePlatformFee";
import {
  contribute,
  cancelCampaign,
  depositRevenue,
  claimRefund,
  claimRevenue,
  verifyCampaign,
} from "../lib/contractClient";
import { isSameAddress } from "../lib/stellar";
import { parseContractError } from "../utils/contractErrors";
import { getAsyncActionErrorMessage, withActionTimeout } from "../utils/asyncAction";
import type {
  TransactionLifecyclePhase,
  TransactionLifecycleOptions,
} from "../lib/contractClient";
import { useWriteGuard } from "../hooks/useWriteGuard";

interface CampaignActionsProps {
  campaign: Campaign;
  onActionSuccess?: () => void;
}

export default function CampaignActions({ campaign, onActionSuccess }: CampaignActionsProps) {
  const { publicKey, connectWallet, isWalletConnected } = useWallet();
  const { admin } = useAdmin();
  const { contribution } = useContribution(campaign.id, publicKey);
  const { platformFeeBps } = usePlatformFee();
  const locale = useLocale();
  const { showSuccess, showError, showWarning } = useToast();
  const { invoke, isPending } = useWriteGuard();
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [revenueAmount, setRevenueAmount] = useState("");
  const [showRevenueInput, setShowRevenueInput] = useState(false);

  const isCreator = isSameAddress(publicKey, campaign.creator);
  const isAdmin = isSameAddress(publicKey, admin);
  const isContributor = contribution > BigInt(0);

  const phaseLabel =
    txPhase === "building"
      ? "Preparing..."
      : txPhase === "signing"
        ? "Signing..."
        : txPhase === "submitting"
          ? "Submitting..."
          : txPhase === "confirming"
            ? "Confirming..."
            : null;

  const handleAction = async (
    actionKey: string,
    action: (options?: TransactionLifecycleOptions) => Promise<string>,
    successMsg: string,
  ) => {
    setTxPhase(null);
    const result = await invoke(actionKey, campaign.id, async () => {
      try {
        const txHash = await withActionTimeout(
          action({ onStatus: ({ phase }) => setTxPhase(phase) }),
        );
        showSuccess(successMsg);
        if (onActionSuccess) onActionSuccess();
        return txHash;
      } catch (err) {
        showError(getAsyncActionErrorMessage(err, parseContractError));
        throw err;
      } finally {
        setTxPhase(null);
      }
    });
    return result;
  };

  const handleDepositRevenue = async () => {
    if (!revenueAmount || parseFloat(revenueAmount) <= 0) return;
    await handleAction(
      "depositRevenue",
      (options) => depositRevenue(campaign.id, xlmToStroops(revenueAmount), options),
      "Revenue deposited!",
    );
    setRevenueAmount("");
    setShowRevenueInput(false);
  };

  const isExpired = Math.floor(Date.now() / 1000) > campaign.deadline;
  const contributionDisabledReason = isCreator
    ? "Creators cannot contribute to their own campaign."
    : campaign.is_cancelled
      ? "This campaign has been cancelled."
      : !campaign.is_active || campaign.funds_withdrawn || isExpired
        ? "This campaign is no longer accepting contributions."
        : null;

  const handleContribute = useCallback(async () => {
    const parsedAmount = Number(contributionAmount);
    if (!publicKey) {
      showWarning("Connect your wallet to contribute.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showWarning("Enter a contribution amount greater than 0 XLM.");
      return;
    }
    if (contributionDisabledReason) {
      showWarning(contributionDisabledReason);
      return;
    }
    setTxPhase(null);
    await invoke("contribute", campaign.id, async () => {
      try {
        await withActionTimeout(
          contribute(campaign.id, publicKey, xlmToStroops(contributionAmount), {
            onStatus: ({ phase }) => setTxPhase(phase),
          }),
        );
        setContributionAmount("");
        showSuccess("Contribution submitted successfully.");
        onActionSuccess?.();
      } catch (err) {
        showError(getAsyncActionErrorMessage(err, parseContractError));
        throw err;
      } finally {
        setTxPhase(null);
      }
    });
  }, [
    contributionAmount,
    publicKey,
    contributionDisabledReason,
    campaign.id,
    invoke,
    showWarning,
    showSuccess,
    showError,
    onActionSuccess,
  ]);

  if (!isWalletConnected) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          Connect your wallet to interact with this campaign.
        </p>
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          A platform fee of {basisPointsToPercentage(platformFeeBps)} is deducted from funds when
          withdrawn by the creator.
        </p>
        <button
          onClick={connectWallet}
          className="w-full py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transition-colors"
        >
          Connect Wallet to Contribute
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isCreator && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            Support this cause
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            A platform fee of {basisPointsToPercentage(platformFeeBps)} is deducted from funds when
            withdrawn by the creator.
          </p>
          <div className="flex flex-col gap-3">
            <label
              className="text-sm text-zinc-700 dark:text-zinc-300"
              htmlFor="contribution-amount"
            >
              Contribution amount
            </label>
            <div className="flex gap-3">
              <input
                id="contribution-amount"
                type="number"
                min="0"
                step="0.1"
                inputMode="decimal"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                placeholder="Amount in XLM"
                disabled={isPending("contribute", campaign.id) || !!contributionDisabledReason}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 outline-none transition focus:border-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                onClick={handleContribute}
                disabled={isPending("contribute", campaign.id) || !!contributionDisabledReason}
                className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400 flex items-center gap-2"
              >
                <AsyncButtonContent
                  isPending={isPending("contribute", campaign.id)}
                  idleLabel="Contribute"
                  pendingLabel={phaseLabel ?? "Processing..."}
                />
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {contributionDisabledReason ??
                "Contributions are made in XLM and recorded on-chain after wallet confirmation."}
            </p>
          </div>
        </div>
      )}

      {isCreator && (
        <>
          <WithdrawFunds
            campaign={campaign}
            userWalletAddress={publicKey}
            platformFeeBps={platformFeeBps}
            onWithdrawSuccess={onActionSuccess}
          />
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              Creator Dashboard
            </h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() =>
                  handleAction("cancelCampaign", (options) => cancelCampaign(campaign.id, options), "Campaign cancelled.")
                }
                disabled={
                  isPending("cancelCampaign", campaign.id) ||
                  !campaign.is_active ||
                  campaign.is_cancelled ||
                  campaign.funds_withdrawn
                }
                className="w-full py-3 min-h-[44px] bg-red-600 hover:bg-red-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <AsyncButtonContent
                  isPending={isPending("cancelCampaign", campaign.id)}
                  idleLabel="Cancel Campaign"
                  pendingLabel={phaseLabel ?? "Cancelling..."}
                />
              </button>
              {campaign.has_revenue_sharing &&
                (showRevenueInput ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={revenueAmount}
                        onChange={(e) => setRevenueAmount(e.target.value)}
                        placeholder="Amount in XLM"
                        className="w-full px-4 py-3 pr-16 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                        XLM
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDepositRevenue}
                        disabled={isPending("depositRevenue", campaign.id) || !revenueAmount}
                        className="flex-1 py-3 min-h-[44px] bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <AsyncButtonContent
                          isPending={isPending("depositRevenue", campaign.id)}
                          idleLabel="Confirm"
                          pendingLabel={phaseLabel ?? "Processing..."}
                        />
                      </button>
                      <button
                        onClick={() => {
                          setShowRevenueInput(false);
                          setRevenueAmount("");
                        }}
                        className="px-4 py-3 min-h-[44px] border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRevenueInput(true)}
                    disabled={isPending("depositRevenue", campaign.id) || campaign.is_cancelled}
                    className="w-full py-3 min-h-[44px] bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
                  >
                    Deposit Revenue
                  </button>
                ))}
            </div>
          </div>
        </>
      )}

      {isAdmin && !campaign.is_verified && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
          <h3 className="text-base font-semibold text-blue-600 mb-4">Admin Panel</h3>
          <button
            onClick={() => handleAction("verifyCampaign", (options) => verifyCampaign(campaign.id, options), "Campaign verified!")}
            disabled={isPending("verifyCampaign", campaign.id)}
            className="w-full py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <AsyncButtonContent
              isPending={isPending("verifyCampaign", campaign.id)}
              idleLabel="Verify Campaign"
              pendingLabel={phaseLabel ?? "Verifying..."}
            />
          </button>
        </div>
      )}

      {isContributor && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            Your Contribution
          </h3>
          <p className="text-2xl font-bold text-blue-600 mb-4">{formatAmount(contribution, locale, { maximumFractionDigits: 2 })} XLM</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() =>
                handleAction("claimRefund", (options) => claimRefund(campaign.id, publicKey!, options), "Refund claimed!")
              }
              disabled={isPending("claimRefund", campaign.id) || (campaign.is_active && !isExpired)}
              title={campaign.is_active && !isExpired ? "Cannot refund while active" : ""}
              className="w-full py-3 min-h-[44px] bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <AsyncButtonContent
                isPending={isPending("claimRefund", campaign.id)}
                idleLabel="Claim Refund"
                pendingLabel="Claiming refund..."
              />
            </button>
            {campaign.has_revenue_sharing && (
              <button
                onClick={() =>
                  handleAction("claimRevenue", (options) => claimRevenue(campaign.id, publicKey!, options), "Revenue claimed!")
                }
                disabled={isPending("claimRevenue", campaign.id)}
                className="w-full py-3 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <AsyncButtonContent
                  isPending={isPending("claimRevenue", campaign.id)}
                  idleLabel="Claim Revenue"
                  pendingLabel="Claiming revenue..."
                />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
