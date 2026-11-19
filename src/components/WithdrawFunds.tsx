"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { withdrawFunds, checkSettlementStatus, getMilestones } from "../lib/contractClient";
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
import { usePlatformStatus } from "../hooks/usePlatformStatus";
import VerifiedIcon from "./icons/VerifiedIcon";

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
  const { isWriteDisabled, isPaused } = usePlatformStatus();
  const isWithdrawing = isPending("withdrawFunds", campaign.id);

  // Settlement status from the contract (issue #1763)
  const [settlementStatus, setSettlementStatus] = useState<{
    deadline_passed: boolean;
    goal_met: boolean;
    ready_for_withdrawal: boolean;
  } | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(true);

  // Whether this campaign uses on-chain milestones (issue #1763)
  const [hasMilestones, setHasMilestones] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      setSettlementLoading(true);
      try {
        const [status, milestones] = await Promise.all([
          checkSettlementStatus(campaign.id),
          getMilestones(campaign.id),
        ]);
        if (!cancelled) {
          setSettlementStatus(status);
          setHasMilestones(milestones.length > 0);
        }
      } catch {
        // If the contract call fails fall back to client-side logic (non-fatal)
        if (!cancelled) {
          const now = Math.floor(Date.now() / 1000);
          const deadline_passed = campaign.deadline < now;
          const goal_met = campaign.amount_raised >= campaign.funding_goal;
          setSettlementStatus({
            deadline_passed,
            goal_met,
            ready_for_withdrawal: deadline_passed && goal_met,
          });
          setHasMilestones((campaign.milestones?.length ?? 0) > 0);
        }
      } finally {
        if (!cancelled) setSettlementLoading(false);
      }
    }
    void fetchStatus();
    return () => {
      cancelled = true;
    };
  }, [campaign.id, campaign.deadline, campaign.amount_raised, campaign.funding_goal, campaign.milestones]);

  const localizeContractError = (message: string) =>
    message.startsWith("ContractErrors.") ? tContractErrors(message) : message;

  const isCreator = isSameAddress(userWalletAddress, campaign.creator);

  if (!isCreator) return null;

  // Milestone campaigns use milestone claims, not bulk withdrawal (issue #1763)
  if (hasMilestones) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          {t("title")}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
          {t("milestoneCampaignNote")}
        </p>
        <Link
          href={`/causes/${campaign.id}#milestones`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {t("viewMilestoneClaims")}
        </Link>
      </div>
    );
  }

  // Use contract-derived settlement status when available, otherwise fall back to client-side
  const readyForWithdrawal = settlementStatus?.ready_for_withdrawal ?? false;
  const goalReached = settlementStatus?.goal_met ?? campaign.amount_raised >= campaign.funding_goal;

  const isDisabled =
    isWriteDisabled ||
    settlementLoading ||
    campaign.is_cancelled ||
    campaign.funds_withdrawn ||
    !readyForWithdrawal;

  const disabledReason = isWriteDisabled
    ? isPaused ? "The platform is paused; withdrawals are unavailable." : "Platform availability cannot be verified."
    : campaign.is_cancelled
    ? t("disabledCancelled")
    : campaign.funds_withdrawn
      ? t("disabledAlreadyWithdrawn")
      : settlementLoading
        ? t("checkingStatus")
        : !settlementStatus?.goal_met
          ? t("disabledGoalNotReached")
          : !settlementStatus?.deadline_passed
            ? t("disabledStillActive")
            : null;

  const totalRaised = stroopsToXlmNumber(campaign.amount_raised);
  const feeAmount = totalRaised * (platformFeeBps / 10000);
  const creatorAmount = totalRaised - feeAmount;
  const feePct = basisPointsToPercentage(platformFeeBps);

  const formatXlm = (value: number) =>
    formatNumber(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 0 });

  const handleWithdraw = async () => {
    if (isWriteDisabled) return;
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
          <VerifiedIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
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
            <a
              href={explorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {txHash}
            </a>{" "}
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
              disabled={isWithdrawing || isWriteDisabled}
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
            {settlementLoading ? t("checkingStatus") : t("withdrawFunds")}
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
