"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatNumber } from "@/lib/formatters";
import { setPersonalCap } from "../lib/contractClient";
import { usePersonalCap } from "../hooks/usePersonalCap";
import { useContribution } from "../hooks/useContribution";
import { useWallet } from "./WalletContext";
import { useToast } from "./ToastProvider";
import { stroopsToXlmNumber, xlmToStroops } from "../lib/stellarAmount";
import { parseContractError } from "../utils/contractErrors";
import AsyncButtonContent from "./AsyncButtonContent";

interface PersonalCapProps {
  campaignId: number;
}

export default function PersonalCap({ campaignId }: PersonalCapProps) {
  const t = useTranslations("PersonalCap");
  const locale = useLocale();
  const { publicKey: userWalletAddress } = useWallet();
  const { showError, showSuccess, showWarning } = useToast();
  const {
    personalCap,
    isLoading,
    refetch: refetchCap,
  } = usePersonalCap(campaignId, userWalletAddress);
  const { contribution, isLoading: isLoadingContribution } = useContribution(
    campaignId,
    userWalletAddress,
  );

  const [capInput, setCapInput] = useState("");
  const [isSetting, setIsSetting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const currentCapXlm = stroopsToXlmNumber(personalCap);
  const currentContributionXlm = stroopsToXlmNumber(contribution);
  const hasCap = personalCap > BigInt(0);

  const parsedInput = (() => {
    const trimmed = capInput.trim();
    if (trimmed === "") return null;
    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0) return null;
    return num;
  })();

  const isBelowContribution =
    parsedInput !== null && contribution > BigInt(0) && parsedInput < currentContributionXlm;
  const formatXlm = useCallback(
    (value: number) => formatNumber(value, locale, { maximumFractionDigits: 7 }),
    [locale],
  );

  const handleSetCap = useCallback(async () => {
    if (!userWalletAddress || parsedInput === null) return;

    const capStroops = xlmToStroops(parsedInput.toString());
    if (capStroops <= BigInt(0)) {
      showWarning(t("positiveAmountWarning"));
      return;
    }

    setIsSetting(true);
    try {
      await setPersonalCap(campaignId, userWalletAddress, capStroops);
      showSuccess(t("capSetSuccess", { amount: formatXlm(stroopsToXlmNumber(capStroops)) }));
      setCapInput("");
      refetchCap();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsSetting(false);
    }
  }, [
    userWalletAddress,
    parsedInput,
    campaignId,
    showSuccess,
    showError,
    showWarning,
    refetchCap,
    t,
    formatXlm,
  ]);

  const handleRemoveCap = useCallback(async () => {
    if (!userWalletAddress) return;

    setIsRemoving(true);
    try {
      await setPersonalCap(campaignId, userWalletAddress, BigInt(0));
      showSuccess(t("capRemovedSuccess"));
      refetchCap();
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsRemoving(false);
    }
  }, [userWalletAddress, campaignId, showSuccess, showError, refetchCap, t]);

  if (!userWalletAddress) return null;
  if (isLoading || isLoadingContribution) {
    return (
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">{t("title")}</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-3">{t("title")}</h2>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{t("description")}</p>

      {/* Current cap display */}
      {hasCap ? (
        <div className="mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
            {t("currentCapLabel")} <span className="font-bold">{formatXlm(currentCapXlm)} XLM</span>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {t("contributedSoFar", { amount: formatXlm(currentContributionXlm) })}
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-3">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("noCapSet")}</p>
          {contribution > BigInt(0) && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {t("currentContributionLabel")} {formatXlm(currentContributionXlm)} XLM
            </p>
          )}
        </div>
      )}

      {/* Set cap input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder={t("amountPlaceholder")}
            value={capInput}
            onChange={(e) => setCapInput(e.target.value)}
            className="flex-1 min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            aria-label={t("amountAriaLabel")}
          />
          <button
            onClick={handleSetCap}
            disabled={isSetting || parsedInput === null || parsedInput <= 0}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-600 min-h-[36px] inline-flex items-center gap-1.5"
          >
            <AsyncButtonContent
              isPending={isSetting}
              idleLabel={t("setCap")}
              pendingLabel={t("setting")}
            />
          </button>
        </div>

        {/* Warning for cap below current contribution */}
        {isBelowContribution && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-2.5">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t("capBelowContribution", { amount: formatXlm(currentContributionXlm) })}
            </p>
          </div>
        )}

        {/* Remove cap button */}
        {hasCap && (
          <button
            onClick={handleRemoveCap}
            disabled={isRemoving}
            className="rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60 min-h-[36px] inline-flex items-center justify-center gap-1.5"
          >
            <AsyncButtonContent
              isPending={isRemoving}
              idleLabel={t("removeCap")}
              pendingLabel={t("removing")}
            />
          </button>
        )}
      </div>
    </div>
  );
}
