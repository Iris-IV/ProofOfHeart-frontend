"use client";

import { useLocale, useTranslations } from "next-intl";
import { getWalletTransactions, WalletTransactionAction } from "@/lib/transactionLog";
import { explorerTxUrl } from "@/utils/explorer";
import { formatShortDate } from "@/lib/formatters";
import type { Campaign } from "@/types";

interface TransactionHistoryTabProps {
  walletAddress: string;
  campaigns: Campaign[];
}

const ACTION_BADGE_CLASSES: Record<WalletTransactionAction, string> = {
  contribute: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  claim_refund: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  claim_revenue: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  deposit_revenue: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  vote: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function getActionLabelKey(action: WalletTransactionAction): string {
  switch (action) {
    case "contribute":
      return "actionContribute";
    case "claim_refund":
      return "actionClaimRefund";
    case "claim_revenue":
      return "actionClaimRevenue";
    case "deposit_revenue":
      return "actionDepositRevenue";
    case "vote":
      return "actionVote";
    default:
      return "actionTransaction";
  }
}

export default function TransactionHistoryTab({
  walletAddress,
  campaigns,
}: TransactionHistoryTabProps) {
  const t = useTranslations("Dashboard");
  const tActions = useTranslations("MyContributions");
  const locale = useLocale();

  const transactions = getWalletTransactions(walletAddress);

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        {t("noTransactionHistory")}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {transactions.map((entry, idx) => {
        const campaign = campaigns.find((c) => c.id === entry.campaignId);
        const campaignTitle = campaign
          ? campaign.title
          : t("campaignFallback", { id: entry.campaignId });
        const actionLabel = tActions(getActionLabelKey(entry.action));
        const badgeClasses =
          ACTION_BADGE_CLASSES[entry.action] ??
          "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
        const dateLabel = formatShortDate(Math.floor(entry.timestamp / 1000), locale);
        const shortHash = `${entry.txHash.slice(0, 10)}…${entry.txHash.slice(-8)}`;

        return (
          <li
            key={`${entry.txHash}-${idx}`}
            className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                  {campaignTitle}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{dateLabel}</p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses}`}
              >
                {actionLabel}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{t("txHash")}:</span>
              <a
                href={explorerTxUrl(entry.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                title={entry.txHash}
              >
                {shortHash}
              </a>
              <span aria-hidden="true">·</span>
              <a
                href={explorerTxUrl(entry.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {t("viewOnStellarExpert")} ↗
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
