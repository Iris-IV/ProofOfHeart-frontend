"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { claimRefund, claimRevenue } from "../lib/contractClient";
import { getStellarExplorerTxUrl } from "../lib/stellarExplorer";
import { useContributions } from "../hooks/useContributions";
import { stroopsToXlmNumber } from "../lib/stellarAmount";
import { useToast } from "./ToastProvider";
import { parseContractError } from "../utils/contractErrors";

interface MyContributionsSectionProps {
  walletAddress: string;
}

type ClaimStatus = "idle" | "pending" | "success" | "failed";

function formatXlmAmount(value: bigint): string {
  return stroopsToXlmNumber(value).toLocaleString(undefined, {
    maximumFractionDigits: 7,
  });
}

function getStatusLabelKey(status: string): string {
  switch (status) {
    case "active":
      return "statusActive";
    case "refundable":
      return "statusRefundable";
    case "revenue-claimable":
      return "statusRevenueClaimable";
    case "funded":
      return "statusFunded";
    case "failed":
      return "statusFailed";
    case "cancelled":
      return "statusCancelled";
    case "verified":
      return "statusVerified";
    default:
      return "statusUnknown";
  }
}

function getStatusClasses(status: string): string {
  switch (status) {
    case "active":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "funded":
      return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case "failed":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "cancelled":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    default:
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function getActionLabel(action: string): string {
  switch (action) {
    case "contribute":
      return "Contribution";
    case "claim_refund":
      return "Refund claim";
    case "claim_revenue":
      return "Revenue claim";
    default:
      return "Transaction";
  }
}

type ClaimKey = `${number}-${"refund" | "revenue"}`;

function claimKey(campaignId: number, type: "refund" | "revenue"): ClaimKey {
  return `${campaignId}-${type}`;
}

export default function MyContributionsSection({ walletAddress }: MyContributionsSectionProps) {
  const t = useTranslations("MyContributions");
  const { showError, showSuccess, showWarning } = useToast();
  const [pendingCampaignId, setPendingCampaignId] = useState<number | null>(null);
  const [claimStatuses, setClaimStatuses] = useState<Map<ClaimKey, ClaimStatus>>(new Map());
  const [isBatchClaiming, setIsBatchClaiming] = useState(false);
  const { contributions, isLoading, isRefreshing, error, refetch } =
    useContributions(walletAddress);

  const totalContributed = useMemo(
    () => contributions.reduce((sum, item) => sum + item.contribution, BigInt(0)),
    [contributions],
  );

  const claimableCount = useMemo(
    () => contributions.filter((item) => item.canClaimRefund || item.canClaimRevenue).length,
    [contributions],
  );

  const markClaimStatus = useCallback((key: ClaimKey, status: ClaimStatus) => {
    setClaimStatuses((prev) => {
      const next = new Map(prev);
      next.set(key, status);
      return next;
    });
  }, []);

  const handleClaimRefund = async (campaignId: number) => {
    setPendingCampaignId(campaignId);
    try {
      await claimRefund(campaignId, walletAddress);
      showSuccess("Refund claimed successfully.");
      refetch();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setPendingCampaignId(null);
    }
  };

  const handleClaimRevenue = async (campaignId: number) => {
    setPendingCampaignId(campaignId);
    try {
      await claimRevenue(campaignId, walletAddress);
      showSuccess("Revenue claimed successfully.");
      refetch();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setPendingCampaignId(null);
    }
  };

  const handleClaimAll = async () => {
    setIsBatchClaiming(true);
    const statusMap = new Map<ClaimKey, ClaimStatus>();
    contributions.forEach((item) => {
      if (item.canClaimRefund) statusMap.set(claimKey(item.campaign.id, "refund"), "idle");
      if (item.canClaimRevenue) statusMap.set(claimKey(item.campaign.id, "revenue"), "idle");
    });
    setClaimStatuses(statusMap);

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of contributions) {
      if (item.canClaimRefund) {
        const key = claimKey(item.campaign.id, "refund");
        markClaimStatus(key, "pending");
        try {
          await claimRefund(item.campaign.id, walletAddress);
          markClaimStatus(key, "success");
          succeeded++;
        } catch (err) {
          markClaimStatus(key, "failed");
          failed++;
          errors.push(`Refund for "${item.campaign.title}": ${parseContractError(err)}`);
        }
      }
      if (item.canClaimRevenue) {
        const key = claimKey(item.campaign.id, "revenue");
        markClaimStatus(key, "pending");
        try {
          await claimRevenue(item.campaign.id, walletAddress);
          markClaimStatus(key, "success");
          succeeded++;
        } catch (err) {
          markClaimStatus(key, "failed");
          failed++;
          errors.push(`Revenue for "${item.campaign.title}": ${parseContractError(err)}`);
        }
      }
    }

    setClaimStatuses(new Map());
    setIsBatchClaiming(false);

    if (failed === 0) {
      showSuccess(`All ${succeeded} claims completed successfully.`);
    } else if (succeeded === 0) {
      showError(`${failed} claim${failed === 1 ? "" : "s"} failed.`);
    } else {
      showWarning(
        `${succeeded} succeeded, ${failed} failed. ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? ` (+${errors.length - 3} more)` : ""}`,
      );
    }

    refetch();
  };

  const isClaiming = (itemId: number, type: "refund" | "revenue"): ClaimStatus => {
    return claimStatuses.get(claimKey(itemId, type)) ?? "idle";
  };

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">My Contributions</h2>
        <div className="flex items-center gap-3">
          {claimableCount > 1 && (
            <button
              onClick={handleClaimAll}
              disabled={isBatchClaiming}
              className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isBatchClaiming ? "Claiming all..." : `Claim All (${claimableCount})`}
            </button>
          )}
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {contributions.length} campaign
            {contributions.length === 1 ? "" : "s"} contributed ·{" "}
            {formatXlmAmount(totalContributed)} XLM total
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading contribution history...</p>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : contributions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No contributions yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {contributions.map((item) => {
            const isPending = pendingCampaignId === item.campaign.id && !isBatchClaiming;
            const refundStatus = isBatchClaiming ? isClaiming(item.campaign.id, "refund") : "idle";
            const revenueStatus = isBatchClaiming
              ? isClaiming(item.campaign.id, "revenue")
              : "idle";
            const contributionTransactions = item.transactions.filter(
              (entry) => entry.action === "contribute",
            );

            let displayStatus = "active";
            if (item.canClaimRefund) displayStatus = "refundable";
            else if (item.canClaimRevenue) displayStatus = "revenue-claimable";
            else if (item.campaign.is_verified) displayStatus = "verified";
            else if (item.campaign.is_cancelled) displayStatus = "cancelled";

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
                      Contributed {formatXlmAmount(item.contribution)} XLM
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
                    Open Campaign
                  </Link>
                  {item.canClaimRefund && (
                    <button
                      aria-label={t("claimRefund")}
                      onClick={() => handleClaimRefund(item.campaign.id)}
                      disabled={isPending || isBatchClaiming}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-white transition disabled:cursor-not-allowed ${
                        refundStatus === "success"
                          ? "bg-green-500"
                          : refundStatus === "failed"
                            ? "bg-red-500"
                            : refundStatus === "pending"
                              ? "bg-amber-400"
                              : "bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-400"
                      }`}
                    >
                      {refundStatus === "success"
                        ? "Refunded ✓"
                        : refundStatus === "failed"
                          ? "Failed ✗"
                          : refundStatus === "pending"
                            ? "Claiming..."
                            : t("claimRefund")}
                    </button>
                  )}
                  {item.canClaimRevenue && (
                    <button
                      aria-label={t("claimRevenue")}
                      onClick={() => handleClaimRevenue(item.campaign.id)}
                      disabled={isPending || isBatchClaiming}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-white transition disabled:cursor-not-allowed ${
                        revenueStatus === "success"
                          ? "bg-green-500"
                          : revenueStatus === "failed"
                            ? "bg-red-500"
                            : revenueStatus === "pending"
                              ? "bg-emerald-400"
                              : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400"
                      }`}
                    >
                      {revenueStatus === "success"
                        ? "Claimed ✓"
                        : revenueStatus === "failed"
                          ? "Failed ✗"
                          : revenueStatus === "pending"
                            ? "Claiming..."
                            : `${t("claimRevenue")} (${formatXlmAmount(item.claimableRevenue)} XLM)`}
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {contributionTransactions.length > 0 ? (
                    contributionTransactions.map((entry) => (
                      <div key={entry.txHash} className="flex items-center gap-2">
                        <span>Contribution tx:</span>
                        <a
                          href={getStellarExplorerTxUrl(entry.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {entry.txHash.slice(0, 10)}...
                          {entry.txHash.slice(-8)}
                        </a>
                      </div>
                    ))
                  ) : (
                    <span>No contribution transaction recorded on this device yet.</span>
                  )}

                  {item.transactions.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-300">
                        Transaction log
                      </p>
                      <ul className="space-y-1">
                        {item.transactions.map((entry) => (
                          <li
                            key={`${entry.action}-${entry.txHash}`}
                            className="flex items-center gap-2"
                          >
                            <span>{getActionLabel(entry.action)}:</span>
                            <a
                              href={getStellarExplorerTxUrl(entry.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {entry.txHash.slice(0, 10)}...
                              {entry.txHash.slice(-8)}
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
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Refreshing contribution history...
        </p>
      )}
    </section>
  );
}
