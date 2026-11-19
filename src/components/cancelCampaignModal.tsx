"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getCancellationPenaltyBps } from "@/lib/contractClient";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";
import { formatNumber } from "@/lib/formatters";

interface CancelCampaignModalProps {
  campaignTitle: string;
  isOpen: boolean;
  isCancelling: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  title?: string;
  confirmLabel?: string;
  /** Amount raised in stroops — used to compute the cancellation penalty. */
  amountRaised?: bigint;
  /** Creator's current XLM balance in stroops — used for the low-balance warning. */
  creatorBalanceStroops?: bigint;
}

/**
 * CancelCampaignModal
 *
 * Confirmation dialog before calling cancel_campaign() on-chain.
 * Shows the cancellation penalty amount the creator will be charged (issue #1764)
 * and warns when their wallet balance is insufficient to cover it.
 */
export default function CancelCampaignModal({
  campaignTitle,
  isOpen,
  isCancelling,
  onConfirm,
  onClose,
  title,
  confirmLabel,
  amountRaised = BigInt(0),
  creatorBalanceStroops,
}: CancelCampaignModalProps) {
  const t = useTranslations("CancelCampaignModal");
  const locale = useLocale();
  const keepActiveRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Fetch the on-chain penalty bps once when the modal opens (issue #1764)
  const [penaltyBps, setPenaltyBps] = useState<number | null>(null);
  const [penaltyLoading, setPenaltyLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPenaltyLoading(true);
    getCancellationPenaltyBps()
      .then((bps) => {
        if (!cancelled) setPenaltyBps(bps);
      })
      .catch(() => {
        if (!cancelled) setPenaltyBps(0);
      })
      .finally(() => {
        if (!cancelled) setPenaltyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Compute penalty amount in XLM
  const penaltyStroops =
    penaltyBps !== null && amountRaised > BigInt(0)
      ? (amountRaised * BigInt(penaltyBps)) / BigInt(10_000)
      : BigInt(0);

  const penaltyXlm = stroopsToXlmNumber(penaltyStroops);
  const penaltyPct = penaltyBps !== null ? (penaltyBps / 100).toFixed(penaltyBps % 100 === 0 ? 0 : 2) : null;

  const insufficientBalance =
    creatorBalanceStroops !== undefined &&
    penaltyStroops > BigInt(0) &&
    creatorBalanceStroops < penaltyStroops;

  const formatXlm = (val: number) =>
    formatNumber(val, locale, { maximumFractionDigits: 4, minimumFractionDigits: 0 });

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Focus trap: cycle Tab/Shift+Tab between the two buttons
      if (e.key === "Tab") {
        const first = keepActiveRef.current;
        const last = cancelRef.current;
        if (!first || !last) return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-focus the safe "Keep Active" button when modal opens
  useEffect(() => {
    if (isOpen) keepActiveRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Backdrop — clicking outside also closes
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-xl">
              ⚠️
            </div>
            <div>
              <h2
                id="cancel-modal-title"
                className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
              >
                {title ?? t("title")}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {t("irreversibleWarning")}
              </p>
            </div>
          </div>
        </div>

        {/* Campaign name */}
        <div className="mx-6 mb-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5">
            {t("campaignLabel")}
          </p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {campaignTitle}
          </p>
        </div>

        {/* Cancellation penalty section (issue #1764) */}
        {penaltyLoading ? (
          <div className="mx-6 mb-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3">
            <p className="text-xs text-zinc-400 animate-pulse">{t("loadingPenalty")}</p>
          </div>
        ) : penaltyBps !== null && penaltyBps > 0 ? (
          <div className="mx-6 mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
              {t("penaltyTitle")}
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t("penaltyDescription", { pct: penaltyPct ?? "?" })}
            </p>
            {amountRaised > BigInt(0) && (
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {t("penaltyAmount", { amount: formatXlm(penaltyXlm) })}
              </p>
            )}
          </div>
        ) : penaltyBps === 0 ? (
          <div className="mx-6 mb-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("noPenalty")}</p>
          </div>
        ) : null}

        {/* Low balance warning (issue #1764) */}
        {insufficientBalance && (
          <div className="mx-6 mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              ⚠️ {t("lowBalanceWarning")}
            </p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">
              {t("lowBalanceDetail", { amount: formatXlm(penaltyXlm) })}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            ref={keepActiveRef}
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("keepActive")}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onConfirm}
            disabled={isCancelling || insufficientBalance}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {isCancelling ? (
              <>
                <span className="inline-block motion-safe:animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                {confirmLabel ? `${confirmLabel}…` : t("cancelling")}
              </>
            ) : (
              (confirmLabel ?? t("confirmCancel"))
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
