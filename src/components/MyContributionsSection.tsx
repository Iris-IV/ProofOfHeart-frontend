"use client";

import { Link } from "@/i18n/routing";
import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useContributions } from "../hooks/useContributions";
import { claimAllRefunds, claimRefund, claimRevenue } from "../lib/contractClient";
import { explorerTxUrl } from "../utils/explorer";
import { formatAmount } from "@/lib/formatters";
import { useToast } from "./ToastProvider";
import { parseContractError } from "../utils/contractErrors";
import type { WalletTransactionAction } from "../lib/transactionLog";
import { type TransactionLifecyclePhase } from "../lib/contractClient";
import type { ContributionHistoryItem } from "../hooks/useContributions";

interface MyContributionsSectionProps {
  walletAddress: string;
}

type ContributionDisplayStatus = "active" | "refundable" | "revenue-claimable";

function getContributionDisplayStatus(item: ContributionHistoryItem): ContributionDisplayStatus {
  if (item.canClaimRefund) return "refundable";
  if (item.canClaimRevenue) return "revenue-claimable";
  return "active";
}

function getStatusLabelKey(status: ContributionDisplayStatus): string {
  switch (status) {
    case "refundable":
      return "statusRefundable";
    case "revenue-claimable":
      return "statusRevenueClaimable";
    default:
      return "statusActive";
  }
}

function getStatusClasses(status: ContributionDisplayStatus): string {
  switch (status) {
    case "refundable":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "revenue-claimable":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    default:
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  }
}

export default function MyContributionsSection({ walletAddress }: MyContributionsSectionProps) {
  const t = useTranslations("MyContributions");
  const locale = useLocale();
  const formatXlmAmount = (value: bigint) =>
    formatAmount(value, locale, { maximumFractionDigits: 7 });
  const { showError, showSuccess } = useToast();
  const [pendingCampaignId, setPendingCampaignId] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<"refund" | "revenue" | null>(null);
  const [isClaimAllPending, setIsClaimAllPending] = useState(false);
  const [claimAllProgress, setClaimAllProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const { contributions, isLoading, isRefreshing, error, refetch } =
    useContributions(walletAddress);

  const totalContributed = useMemo(
    () => contributions.reduce((sum, item) => sum + item.contribution, BigInt(0)),
    [contributions],
  );

  const refundableCampaignIds = useMemo(
    () =>
      contributions
        .filter((item) => item.canClaimRefund)
        .map((item) => item.campaign.id),
    [contributions],
  );

  const getActionLabel = (action: WalletTransactionAction): string => {
    switch (action) {
      case "contribute":
        return t("actionContribute");
      case "claim_refund":
        return t("actionClaimRefund");
      case "claim_revenue":
        return t("actionClaimRevenue");
      case "deposit_revenue":
        return t("actionDepositRevenue");
      case "vote":
        return t("actionVote");
      default:
        return t("actionTransaction");
    }
  };

  const getPendingLabel = (action: "refund" | "revenue") => {
    if (txPhase === "signing") return t("signing");
    if (txPhase === "confirming") return t("confirming");
    return action === "refund" ? t("claimingRefund") : t("claimingRevenue");
  };

  const getClaimAllLabel = () => {
    if (!isClaimAllPending) {
      return t("claimAll", { count: refundableCampaignIds.length });
    }
    if (txPhase === "signing") return t("signing");
    if (txPhase === "confirming") return t("confirming");
    if (claimAllProgress) {
      return t("claimingAll", {
        current: claimAllProgress.current,
        total: claimAllProgress.total,
      });
    }
    return t("claimAll", { count: refundableCampaignIds.length });
  };

  const handleClaimAllRefunds = async () => {
    if (refundableCampaignIds.length === 0) return;

    setIsClaimAllPending(true);
    setClaimAllProgress(null);
    setTxPhase(null);
    try {
      await claimAllRefunds(refundableCampaignIds, walletAddress, {
        onStatus: ({ phase }) => setTxPhase(phase),
        onProgress: ({ current, total }) => setClaimAllProgress({ current, total }),
      });
      showSuccess(t("claimAllSuccess", { count: refundableCampaignIds.length }));
      refetch();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsClaimAllPending(false);
      setClaimAllProgress(null);
      setTxPhase(null);
    }
  };

  const handleClaimRefund = async (campaignId: number) => {
    setPendingCampaignId(campaignId);
    setPendingAction("refund");
    setTxPhase(null);
    try {
      await claimRefund(campaignId, walletAddress, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      showSuccess(t("refundSuccess"));
      refetch();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setPendingCampaignId(null);
      setPendingAction(null);
      setTxPhase(null);
    }
  };

  const handleClaimRevenue = async (campaignId: number) => {
    setPendingCampaignId(campaignId);
    setPendingAction("revenue");
    setTxPhase(null);
    try {
      await claimRevenue(campaignId, walletAddress, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      showSuccess(t("revenueSuccess"));
      refetch();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setPendingCampaignId(null);
      setPendingAction(null);
      setTxPhase(null);
    }
  };

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("summary", {
              count: contributions.length,
              total: formatXlmAmount(totalContributed),
            })}
          </div>
        </div>
        {refundableCampaignIds.length >= 2 && (
          <button
            type="button"
            onClick={handleClaimAllRefunds}
            disabled={isClaimAllPending || pendingCampaignId !== null}
            className="inline-flex w-full items-center justify-center rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-400 sm:w-auto sm:self-start"
          >
            {getClaimAllLabel()}
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-zinc-500 dark:text-zinc-400">{t("loading")}</p>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : contributions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {contributions.map((item) => {
            const isPending = pendingCampaignId === item.campaign.id;
            const isActionDisabled = isPending || isClaimAllPending;
            const displayStatus = getContributionDisplayStatus(item);
            const contributionTransactions = item.transactions.filter(
              (entry) => entry.action === "contribute",
            );
            return (
              <li
                key={item.campaign.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {item.campaign.title}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {t("contributed", { amount: formatXlmAmount(item.contribution) })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(displayStatus)}`}
                  >
                    {t(getStatusLabelKey(displayStatus))}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <Link
                    href={`/causes/${item.campaign.id}`}
                    className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t("openCampaign")}
                  </Link>
                  {item.canClaimRefund && (
                    <button
                      onClick={() => handleClaimRefund(item.campaign.id)}
                      disabled={isActionDisabled}
                      className="inline-flex items-center rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                      {isPending && pendingAction === "refund"
                        ? getPendingLabel("refund")
                        : t("claimRefund")}
                    </button>
                  )}
                  {item.canClaimRevenue && (
                    <button
                      onClick={() => handleClaimRevenue(item.campaign.id)}
                      disabled={isActionDisabled}
                      className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                      {isPending && pendingAction === "revenue"
                        ? getPendingLabel("revenue")
                        : t("claimRevenue", {
                            amount: formatXlmAmount(item.claimableRevenue),
                          })}
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {contributionTransactions.length > 0 ? (
                    contributionTransactions.map((entry) => (
                      <div key={entry.txHash} className="flex items-center gap-2">
                        <span>{t("contributionTx")}</span>
                        <a
                          href={explorerTxUrl(entry.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {entry.txHash.slice(0, 10)}...{entry.txHash.slice(-8)}
                        </a>
                      </div>
                    ))
                  ) : (
                    <span>{t("noContributionTx")}</span>
                  )}

                  {item.transactions.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">
                        {t("transactionLog")}
                      </p>
                      <ul className="space-y-1">
                        {item.transactions.map((entry) => (
                          <li
                            key={`${entry.action}-${entry.txHash}`}
                            className="flex items-center gap-2"
                          >
                            <span>{getActionLabel(entry.action)}:</span>
                            <a
                              href={explorerTxUrl(entry.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {entry.txHash.slice(0, 10)}...{entry.txHash.slice(-8)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isRefreshing && !isLoading && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t("refreshing")}</p>
      )}
    </section>
  );
}
