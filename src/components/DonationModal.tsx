"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { contribute } from "../lib/contractClient";
import { getEstimatedContributeNetworkFeeXlm } from "../lib/networkFee";
import { Campaign, xlmToStroops, formatStroopsAsXlm, basisPointsToPercentage } from "../types";
import { useToast } from "./ToastProvider";
import { useWallet } from "./WalletContext";
import { usePlatformFee } from "../hooks/usePlatformFee";
import { parseContractError } from "../utils/contractErrors";
import { type TransactionLifecyclePhase } from "../lib/contractClient";
import { validateContributorNotCreator } from "../utils/validators";
import { explorerTxUrl } from "../utils/explorer";
import {
  trackClickContribute,
  trackEnterAmount,
  trackReviewContribution,
  trackSignTransaction,
  trackContributionConfirmed,
  trackContributionError,
} from "../lib/analytics";

interface DonationModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "input" | "pending" | "confirmed";

type DonationValidationKey =
  | "scientificNotation"
  | "invalidNumber"
  | "invalidAmount"
  | "amountMustBePositive"
  | "invalidNumberFormat"
  | "maxDecimalPlaces";

export default function DonationModal({ campaign, onClose, onSuccess }: DonationModalProps) {
  const t = useTranslations("Donation");
  const { publicKey } = useWallet();
  const { showError } = useToast();
  const { platformFeeBps } = usePlatformFee();
  const estimatedNetworkFeeXlm = useMemo(() => getEstimatedContributeNetworkFeeXlm(), []);

  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const localizeContractError = (message: string) =>
    message.startsWith("ContractErrors.") ? tContractErrors(message) : message;

  const formatError = (message: string) =>
    message.startsWith("ContractErrors.") ? localizeContractError(message) : t(message as DonationValidationKey);

  // Body scroll lock + focus restoration
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    trackClickContribute(campaign.id);

    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, [campaign.id]);

  // ESC to close + focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "pending") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
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
  }, [step, onClose]);

  const locale = useLocale();
  const goal = Number(stroopsToXlm(campaign.funding_goal));
  const raised = Number(stroopsToXlm(campaign.amount_raised));

  const validateAmount = (
    value: string,
  ): { valid: boolean; errorKey?: DonationValidationKey; amount?: number } => {
    const trimmed = value.trim();

    if (!trimmed) {
      return { valid: false };
    }

    if (/[eE]/.test(trimmed)) {
      return { valid: false, errorKey: "scientificNotation" };
    }

    const parsed = parseFloat(trimmed);

    if (isNaN(parsed)) {
      return { valid: false, errorKey: "invalidNumber" };
    }

    if (!isFinite(parsed)) {
      return { valid: false, errorKey: "invalidAmount" };
    }

    if (parsed <= 0) {
      return { valid: false, errorKey: "amountMustBePositive" };
    }

    const parts = trimmed.split(".");
    if (parts.length > 2) {
      return { valid: false, errorKey: "invalidNumberFormat" };
    }
    if (parts[1] && parts[1].length > 7) {
      return { valid: false, errorKey: "maxDecimalPlaces" };
    }

    return { valid: true, amount: parsed };
  };

  const validation = validateAmount(amount);
  const amountNum = validation.amount || 0;
  const newRaised = raised + amountNum;
  const newPct = goal > 0 ? Math.min(100, Math.round((newRaised / goal) * 100)) : 0;
  const currentPct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const totalWalletCost =
    amountNum > 0 ? amountNum + estimatedNetworkFeeXlm : estimatedNetworkFeeXlm;

  const handleDonate = async () => {
    if (!publicKey) return;

    try {
      validateContributorNotCreator(publicKey, campaign.creator);
    } catch (err) {
      const msg = parseContractError(err);
      setError(msg);
      trackContributionError(campaign.id, "contributor_is_creator");
      return;
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      setError(amountValidation.errorKey ?? "invalidAmount");
      trackContributionError(campaign.id, "invalid_amount");
      return;
    }

    const amountToSend = amount;
    setError(null);
    setStep("pending");
    setTxPhase(null);

    trackReviewContribution(campaign.id);

    try {
      const stroops = xlmToStroops(amountToSend);
      const hash = await contribute(campaign.id, publicKey, stroops, {
        onStatus: ({ phase }) => {
          setTxPhase(phase);
          if (phase === "signing") {
            trackSignTransaction(campaign.id);
          }
        },
      });
      setTxHash(hash);
      setStep("confirmed");
      trackContributionConfirmed(campaign.id);
      onSuccess();
    } catch (err) {
      const msg = parseContractError(err);
      const localized = localizeContractError(msg);
      showError(localized);
      setError(msg);
      setStep("input");
      setTxPhase(null);

      const errorType = msg.toLowerCase().includes("rejected")
        ? "user_rejected"
        : msg.toLowerCase().includes("insufficient")
          ? "insufficient_funds"
          : "transaction_failed";
      trackContributionError(campaign.id, errorType);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && step !== "pending" && onClose()}
      onKeyDown={(e) => {
        if (e.key === "Escape" && step !== "pending") {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-modal-title"
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-700 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2
            id="donation-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {step === "confirmed" ? t("confirmedTitle") : t("title")}
          </h2>
          {step !== "pending" && (
            <button
              onClick={onClose}
              aria-label={t("closeAriaLabel")}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{campaign.title}</p>

          <div>
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>{t("percentFunded", { percent: currentPct })}</span>
              <span>
                {formatAmount(campaign.amount_raised, locale, { maximumFractionDigits: 2 })} / {formatAmount(campaign.funding_goal, locale, { maximumFractionDigits: 2 })} XLM
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
              <div
                className="bg-linear-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${step === "confirmed" ? newPct : currentPct}%` }}
              />
            </div>
          </div>

          {step === "input" && (
            <>
              <div>
                <label
                  htmlFor="donation-amount"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  {t("amountLabel")}
                </label>
                <div className="relative">
                  <input
                    id="donation-amount"
                    type="number"
                    min="0.0000001"
                    step="any"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                      if (e.target.value && parseFloat(e.target.value) > 0) {
                        trackEnterAmount(campaign.id);
                      }
                    }}
                    placeholder={t("amountPlaceholder")}
                    className="w-full px-4 py-3 pr-16 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-400">
                    XLM
                  </span>
                </div>
                {error && <p className="mt-1 text-xs text-red-500">{formatError(error)}</p>}
              </div>

              {amountNum > 0 && (
                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
                  {t("afterDonation", { percent: newPct })}
                  {newRaised >= goal && (
                    <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                      🎉 {t("goalReached")}
                    </span>
                  )}
                </div>
              )}

              {amountNum > 0 && (
                <dl className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-sm space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-600 dark:text-zinc-400">{t("contributionLine")}</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-50 tabular-nums">
                      {amountNum.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-600 dark:text-zinc-400">{t("networkFeeLine")}</dt>
                    <dd className="font-medium text-zinc-900 dark:text-zinc-50 tabular-nums">
                      {estimatedNetworkFeeXlm.toLocaleString(undefined, {
                        maximumFractionDigits: 7,
                      })}{" "}
                      XLM
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-zinc-200 dark:border-zinc-600 pt-2">
                    <dt className="font-semibold text-zinc-900 dark:text-zinc-50">{t("totalLine")}</dt>
                    <dd className="font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">
                      {totalWalletCost.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM
                    </dd>
                  </div>
                </dl>
              )}

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("platformFeeNote", { feePercent: basisPointsToPercentage(platformFeeBps) })}
              </p>
              {amountNum > 0 && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("networkFeeNote")}</p>
              )}

              <button
                onClick={handleDonate}
                disabled={!publicKey || !validation.valid}
                className="w-full py-3 bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200"
              >
                {amountNum > 0 ? t("donateAmount", { amount: amountNum }) : t("donate")}
              </button>
            </>
          )}

          {step === "pending" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent motion-safe:animate-spin" />
              <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center">
                {txPhase === "signing"
                  ? t("waitingSignature")
                  : txPhase === "confirming"
                    ? t("waitingConfirmation")
                    : t("submitting")}
              </p>
            </div>
          )}

          {step === "confirmed" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-3xl">
                ✓
              </div>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {t("donatedSuccess", { amount: amountNum })}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("thankYou")}</p>
              </div>
              {txHash && (
                <a
                  href={explorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                >
                  {t("viewExplorer")}
                </a>
              )}
              <button
                onClick={onClose}
                className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-xl transition-colors"
              >
                {t("close")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
