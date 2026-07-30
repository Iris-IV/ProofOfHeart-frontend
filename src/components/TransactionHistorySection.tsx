"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getWalletTransactions, type WalletTransactionLogEntry } from "../lib/transactionLog";
import { explorerTxUrl } from "../utils/explorer";

interface TransactionHistorySectionProps {
  walletAddress: string;
  /** Campaign titles keyed by campaign ID, used for display. */
  campaignTitleMap: Record<number, string>;
}

function getActionLabel(action: WalletTransactionLogEntry["action"]): string {
  switch (action) {
    case "contribute":
      return "Contribute";
    case "claim_refund":
      return "Claim Refund";
    case "claim_revenue":
      return "Claim Revenue";
    case "claim_reserve":
      return "Claim Reserve";
    case "deposit_revenue":
      return "Deposit Revenue";
    case "withdraw":
      return "Withdraw Funds";
    case "vote":
      return "Vote";
    default:
      return "Transaction";
  }
}

function getActionColor(action: WalletTransactionLogEntry["action"]): string {
  switch (action) {
    case "contribute":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "claim_refund":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "claim_revenue":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
    case "claim_reserve":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "deposit_revenue":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
    case "withdraw":
      return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
    case "vote":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TransactionHistorySection({
  walletAddress,
  campaignTitleMap,
}: TransactionHistorySectionProps) {
  const [entries, setEntries] = useState<WalletTransactionLogEntry[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Read from localStorage only on the client side.
  useEffect(() => {
    setEntries(getWalletTransactions(walletAddress));
    setIsMounted(true);
  }, [walletAddress]);

  const [filterAction, setFilterAction] = useState<WalletTransactionLogEntry["action"] | "all">(
    "all",
  );

  const filtered = useMemo(() => {
    if (filterAction === "all") return entries;
    return entries.filter((e) => e.action === filterAction);
  }, [entries, filterAction]);

  if (!isMounted) return null;

  const actionOptions: Array<WalletTransactionLogEntry["action"] | "all"> = [
    "all",
    "contribute",
    "withdraw",
    "claim_refund",
    "claim_revenue",
    "claim_reserve",
    "deposit_revenue",
    "vote",
  ];

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Transaction History</h2>

      {entries.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No on-chain transactions recorded for this wallet yet.
        </p>
      ) : (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter transactions">
            {actionOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterAction(opt)}
                aria-pressed={filterAction === opt}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterAction === opt
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500"
                }`}
              >
                {opt === "all" ? "All" : getActionLabel(opt)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              No transactions match this filter.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Transaction history">
              {filtered.map((entry) => {
                const campaignTitle =
                  campaignTitleMap[entry.campaignId] ?? `Campaign #${entry.campaignId}`;
                return (
                  <li
                    key={`${entry.txHash}-${entry.timestamp}`}
                    className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 bg-white dark:bg-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${getActionColor(entry.action)}`}
                        >
                          {getActionLabel(entry.action)}
                        </span>
                        <Link
                          href={`/causes/${entry.campaignId}`}
                          className="text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[200px] sm:max-w-none"
                          title={campaignTitle}
                        >
                          {campaignTitle}
                        </Link>
                      </div>
                      <time
                        className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0"
                        dateTime={new Date(entry.timestamp).toISOString()}
                      >
                        {formatTimestamp(entry.timestamp)}
                      </time>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[180px] sm:max-w-[300px]">
                        {entry.txHash}
                      </span>
                      <a
                        href={explorerTxUrl(entry.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View transaction ${entry.txHash} on Stellar Explorer`}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                      >
                        ↗ Explorer
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
