"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { withdrawFunds } from "../lib/contractClient";
import { Campaign, basisPointsToPercentage } from "../types";
import { formatNumber } from "@/lib/formatters";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { useToast } from "./ToastProvider";
import { isSameAddress } from "../lib/stellar";
import { parseContractError } from "../utils/contractErrors";
import { explorerTxUrl } from "../utils/explorer";
import {
  type TransactionLifecyclePhase,
  type TransactionLifecycleOptions,
} from "../lib/contractClient";
import { useWriteGuard } from "../hooks/useWriteGuard";

interface WithdrawFundsProps {
  campaign: Campaign;
  userWalletAddress: string | null;
  platformFeeBps?: number;
  onWithdrawSuccess?: () => void;
}

export default function WithdrawFunds({
  campaign,
  userWalletAddress,
  platformFeeBps = 300,
  onWithdrawSuccess,
}: WithdrawFundsProps) {
  const t = useTranslations("WithdrawFunds");
  const locale = useLocale();
  const tContractErrors = useTranslations("ContractErrors");
  const [showConfirm, setShowConfirm] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const { showError, showSuccess } = useToast();
  const { invoke, isPending } = useWriteGuard();
  const isWithdrawing = isPending("withdrawFunds", campaign.id);

  const localizeContractError = (message: string) =>
    message.startsWith("ContractErrors.") ? tContractErrors(message) : message;

  const isCreator = isSameAddress(userWalletAddress, campaign.creator);

  if (!isCreator) return null;

  const now = Math.floor(Date.now() / 1000);
  const deadlinePassed = campaign.deadline < now;
  const goalReached = campaign.amount_raised >= campaign.funding_goal;

  const isDisabled =
    campaign.is_cancelled ||
    campaign.funds_withdrawn ||
    !goalReached ||
    (campaign.is_active && !deadlinePassed);

  const disabledReason = campaign.is_cancelled
    ? t("disabledCancelled")
    : campaign.funds_withdrawn
      ? t("disabledAlreadyWithdrawn")
      : !goalReached
        ? t("disabledGoalNotReached")
        : campaign.is_active && !deadlinePassed
          ? t("disabledStillActive")
          : null;

  const totalRaised = stroopsToXlmNumber(campaign.amount_raised);
  const feeAmount = totalRaised * (platformFeeBps / 10000);
  const creatorAmount = totalRaised - feeAmount;
  const feePct = basisPointsToPercentage(platformFeeBps);

  const formatXlm = (value: number) =>
    formatNumber(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  const handleWithdraw = async () => {
    setTxPhase(null);
    await invoke("withdrawFunds", campaign.id, async () => {
      try {
        const hash = await withdrawFunds(campaign.id, {
          onStatus: ({ phase }) => setTxPhase(phase),
        } as TransactionLifecycleOptions);
        setTxHash(hash);
        showSuccess(t("withdrawalSuccessToast", { amount: formatXlm(creatorAmount) }));
        onWithdrawSuccess?.();
      } catch (err) {
        showError(localizeContractError(parseContractError(err)));
        throw err;
      } finally {
        setShowConfirm(false);
        setTxPhase(null);
      }
    });
  };

  if (txHash) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-5 h-5 text-green-600 dark:text-green-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
            {t("withdrawalSuccessful")}
          </h3>
        </div>
        <div className="space-y-1.5 text-sm text-green-700 dark:text-green-300">
          <p>
            <span className="font-medium">{t("amountReceived")}</span> {formatXlm(creatorAmount)}{" "}
            XLM
          </p>
          <p>
            <span className="font-medium">{t("platformFeeLabel")}</span> {formatXlm(feeAmount)} XLM
          </p>
          <p className="break-all">
            <span className="font-medium">{t("transaction")}</span>{" "}
            <span className="font-mono text-xs">{txHash}</span>{" "}
            <a
              href={explorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="ms-2 text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
            >
              {t("viewOnExplorer")}
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">{t("title")}</h3>

      {goalReached && !campaign.funds_withdrawn && !campaign.is_cancelled && (
        <div className="mb-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
            <span>{t("totalRaised")}</span>
            <span>{formatXlm(totalRaised)} XLM</span>
          </div>
          <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
            <span>{t("platformFeeWithPercent", { percent: feePct })}</span>
            <span>-{formatXlm(feeAmount)} XLM</span>
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-600 pt-1.5 flex justify-between font-semibold text-zinc-900 dark:text-zinc-50">
            <span>{t("youWillReceive")}</span>
            <span>{formatXlm(creatorAmount)} XLM</span>
          </div>
        </div>
      )}

      {showConfirm ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("confirmMessage", {
              total: formatXlm(totalRaised),
              fee: formatXlm(feeAmount),
              net: formatXlm(creatorAmount),
            })}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing}
              className="flex-1 px-4 py-3 min-h-[44px] bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWithdrawing
                ? txPhase === "signing"
                  ? t("signing")
                  : txPhase === "confirming"
                    ? t("confirming")
                    : t("processing")
                : t("confirmWithdrawal")}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isWithdrawing}
              className="px-4 py-3 min-h-[44px] border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              {t("cancel")}
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
            {t("withdrawFunds")}
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
