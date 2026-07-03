"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import AsyncButtonContent from "./AsyncButtonContent";
import { useToast } from "./ToastProvider";
import { useWallet } from "./WalletContext";
import { useWriteGuard } from "../hooks/useWriteGuard";
import {
  getCampaignReserve,
  claimReserve,
  type CampaignReserve,
  type TransactionLifecyclePhase,
} from "../lib/contractClient";
import { isSameAddress } from "../lib/stellar";
import { stroopsToXlmNumber } from "../lib/stellarAmount";
import { formatXlm, formatDate } from "../lib/formatters";
import { parseContractError } from "../utils/contractErrors";
import { explorerTxUrl } from "../utils/explorer";
import { Campaign } from "../types";

interface VestingReservePanelProps {
  campaign: Campaign;
  onActionSuccess?: () => void;
}

export default function VestingReservePanel({
  campaign,
  onActionSuccess,
}: VestingReservePanelProps) {
  const { publicKey } = useWallet();
  const locale = useLocale();
  const { showSuccess, showError } = useToast();
  const { invoke, isPending } = useWriteGuard();

  const [reserve, setReserve] = useState<CampaignReserve | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);

  const isCreator = isSameAddress(publicKey, campaign.creator);

  // Only show this panel to the campaign creator.
  if (!isCreator) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getCampaignReserve(campaign.id)
      .then((data) => {
        if (!cancelled) {
          setReserve(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.id, txHash]);

  // Nothing to show if there's no reserve entry at all.
  if (!isLoading && !reserve) return null;

  const now = Math.floor(Date.now() / 1000);
  const isReleasable = reserve ? now >= reserve.release_timestamp && !reserve.released : false;
  const reserveXlm = reserve ? stroopsToXlmNumber(reserve.amount) : 0;

  const phaseLabel =
    txPhase === "building"
      ? "Preparing..."
      : txPhase === "signing"
        ? "Signing..."
        : txPhase === "submitting"
          ? "Submitting..."
          : txPhase === "confirming"
            ? "Confirming..."
            : "Claim Reserve";

  const handleClaimReserve = async () => {
    await invoke("claimReserve", campaign.id, async () => {
      try {
        const hash = await claimReserve(campaign.id, {
          onStatus: ({ phase }) => setTxPhase(phase),
        });
        setTxHash(hash);
        showSuccess("Vesting reserve claimed successfully!");
        onActionSuccess?.();
      } catch (err) {
        showError(parseContractError(err));
        throw err;
      } finally {
        setTxPhase(null);
      }
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-emerald-200 dark:border-emerald-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg" aria-hidden="true">
          🔒
        </span>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Vesting Reserve</h2>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading reserve status…</p>
      ) : reserve ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Reserve Amount</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatXlm(reserveXlm, locale)} XLM
              </p>
            </div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/40 p-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Release Date</p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {formatDate(reserve.release_timestamp, locale)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                reserve.released
                  ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
                  : isReleasable
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              }`}
            >
              {reserve.released ? "✓ Released" : isReleasable ? "● Claimable now" : "⏳ Locked"}
            </span>
            {!reserve.released && !isReleasable && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Unlocks {formatDate(reserve.release_timestamp, locale)}
              </span>
            )}
          </div>

          {reserve.released || txHash ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Reserve successfully claimed
              </p>
              {txHash && (
                <a
                  href={explorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-mono break-all"
                >
                  View transaction ↗
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={handleClaimReserve}
              disabled={!isReleasable || isPending("claimReserve", campaign.id)}
              title={
                !isReleasable
                  ? `Reserve locked until ${formatDate(reserve.release_timestamp, locale)}`
                  : undefined
              }
              className="w-full py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <AsyncButtonContent
                isPending={isPending("claimReserve", campaign.id)}
                idleLabel="Claim Reserve"
                pendingLabel={phaseLabel}
              />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
