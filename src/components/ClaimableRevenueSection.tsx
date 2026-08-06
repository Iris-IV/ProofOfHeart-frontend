"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { claimRevenue, type TransactionLifecyclePhase } from "../lib/contractClient";
import { useContributions } from "../hooks/useContributions";
import { formatAmount } from "@/lib/formatters";
import { Category } from "../types";
import { Button, Card } from "./ui";
import { useToast } from "./ToastProvider";
import { parseContractError } from "../utils/contractErrors";

interface ClaimableRevenueSectionProps {
  walletAddress: string;
}

/**
 * Dashboard section listing every EducationalStartup campaign where the
 * connected contributor has unclaimed revenue-sharing revenue, with a
 * one-click Claim button per campaign.
 *
 * Reuses the canonical claimable computation from `useContributions`
 * (get_contribution × get_revenue_pool ÷ amount_raised − get_revenue_claimed)
 * and the existing `claimRevenue` binding — no new data source is invented.
 */
export default function ClaimableRevenueSection({ walletAddress }: ClaimableRevenueSectionProps) {
  const locale = useLocale();
  const { showError, showSuccess } = useToast();
  const { contributions, isLoading, isRefreshing, error, refetch } =
    useContributions(walletAddress);

  // Campaign id currently being claimed, and the tx lifecycle phase for its label.
  const [pendingCampaignId, setPendingCampaignId] = useState<number | null>(null);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);

  const claimable = useMemo(
    () =>
      contributions.filter(
        (item) =>
          item.campaign.category === Category.EducationalStartup &&
          item.canClaimRevenue &&
          item.claimableRevenue > BigInt(0),
      ),
    [contributions],
  );

  const totalClaimable = useMemo(
    () => claimable.reduce((sum, item) => sum + item.claimableRevenue, BigInt(0)),
    [claimable],
  );

  const handleClaim = async (campaignId: number) => {
    setPendingCampaignId(campaignId);
    setTxPhase(null);
    try {
      await claimRevenue(campaignId, walletAddress, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });
      showSuccess("Revenue claimed successfully.");
      // Refetch so the claimed row recomputes to 0 and drops out of the list.
      refetch();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setPendingCampaignId(null);
      setTxPhase(null);
    }
  };

  const claimLabel = (isPending: boolean): string => {
    if (!isPending) return "Claim";
    if (txPhase === "signing") return "Signing...";
    if (txPhase === "confirming") return "Confirming...";
    return "Processing...";
  };

  return (
    <section className="mb-8" aria-labelledby="claimable-revenue-heading">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="claimable-revenue-heading" className="text-xl font-semibold">
          Claimable Revenue
        </h2>
        {claimable.length > 0 && (
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {claimable.length} campaign{claimable.length === 1 ? "" : "s"} ·{" "}
            {formatAmount(totalClaimable, locale, { maximumFractionDigits: 4 })} XLM claimable
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading claimable revenue...</p>
      ) : error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : claimable.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          You have no claimable revenue right now. Revenue from Educational Startup campaigns you
          contributed to will appear here once it is available to claim.
        </div>
      ) : (
        <ul className="space-y-3">
          {claimable.map((item) => {
            const isPending = pendingCampaignId === item.campaign.id;
            return (
              <li key={item.campaign.id}>
                <Card padding="sm" className="bg-zinc-50 dark:bg-zinc-900">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/causes/${item.campaign.id}`}
                        className="font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-50 dark:hover:text-blue-400"
                      >
                        {item.campaign.title}
                      </Link>
                      <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                        {formatAmount(item.claimableRevenue, locale, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        XLM claimable
                      </p>
                    </div>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleClaim(item.campaign.id)}
                      disabled={pendingCampaignId !== null}
                      isLoading={isPending}
                      loadingLabel={claimLabel(true)}
                      aria-label={`Claim revenue for ${item.campaign.title}`}
                    >
                      {claimLabel(false)}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {isRefreshing && !isLoading && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Refreshing claimable revenue...
        </p>
      )}
    </section>
  );
}
