"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import {
  setCancellationPenaltyBps,
  setMinCampaignFundingGoal,
  setMaxCampaignFundingGoal,
} from "@/lib/contractClient";
import { parseContractError } from "@/utils/contractErrors";
import type { TransactionLifecyclePhase } from "@/lib/contractClient";
import { Loader2 } from "lucide-react";

export default function LimitsFeesSection() {
  const t = useTranslations("Admin");
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const [minFundingGoal, setMinFundingGoal] = useState("");
  const [maxFundingGoal, setMaxFundingGoal] = useState("");
  const [maxContributionPerTx, setMaxContributionPerTx] = useState("");
  const [cancellationPenalty, setCancellationPenalty] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{
    minFundingGoal?: bigint;
    maxFundingGoal?: bigint;
    maxContributionPerTx?: bigint;
    cancellationPenalty?: number;
  } | null>(null);

  const validateInputs = (): boolean => {
    if (minFundingGoal && isNaN(Number(minFundingGoal))) {
      showError("Invalid minimum funding goal");
      return false;
    }

    if (maxFundingGoal && isNaN(Number(maxFundingGoal))) {
      showError("Invalid maximum funding goal");
      return false;
    }

    if (maxContributionPerTx && isNaN(Number(maxContributionPerTx))) {
      showError("Invalid max contribution per transaction");
      return false;
    }

    if (cancellationPenalty) {
      const penalty = Number(cancellationPenalty);
      if (isNaN(penalty) || penalty < 0 || penalty > 10000) {
        showError(t("limitsFees.penalty") + " must be between 0 and 10000");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateInputs()) return;

    const changes: typeof pendingChanges = {};

    if (minFundingGoal) changes.minFundingGoal = BigInt(minFundingGoal);
    if (maxFundingGoal) changes.maxFundingGoal = BigInt(maxFundingGoal);
    if (maxContributionPerTx) changes.maxContributionPerTx = BigInt(maxContributionPerTx);
    if (cancellationPenalty) changes.cancellationPenalty = Number(cancellationPenalty);

    if (Object.keys(changes).length === 0) {
      showError("Please enter at least one value to update");
      return;
    }

    setPendingChanges(changes);
    setIsConfirmOpen(true);
  };

  const performUpdate = async () => {
    if (!pendingChanges) return;

    setIsConfirmOpen(false);
    setIsUpdating(true);
    setTxPhase(null);

    try {
      // Execute all selected updates
      const txHashes: string[] = [];

      if (pendingChanges.minFundingGoal !== undefined) {
        const hash = await setMinCampaignFundingGoal(pendingChanges.minFundingGoal, {
          onStatus: ({ phase }) => setTxPhase(phase),
        });
        txHashes.push(hash);
      }

      if (pendingChanges.maxFundingGoal !== undefined) {
        const hash = await setMaxCampaignFundingGoal(pendingChanges.maxFundingGoal, {
          onStatus: ({ phase }) => setTxPhase(phase),
        });
        txHashes.push(hash);
      }

      if (pendingChanges.maxContributionPerTx !== undefined) {
        const hash = await setMaxContributionPerTx(pendingChanges.maxContributionPerTx, {
          onStatus: ({ phase }) => setTxPhase(phase),
        });
        txHashes.push(hash);
      }

      if (pendingChanges.cancellationPenalty !== undefined) {
        const hash = await setCancellationPenaltyBps(pendingChanges.cancellationPenalty, {
          onStatus: ({ phase }) => setTxPhase(phase),
        });
        txHashes.push(hash);
      }

      showSuccess(t("limitsFees.limitsSuccess"));
      setMinFundingGoal("");
      setMaxFundingGoal("");
      setMaxContributionPerTx("");
      setCancellationPenalty("");

      await queryClient.invalidateQueries({ queryKey: ["platformStats"] });
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsUpdating(false);
      setTxPhase(null);
      setPendingChanges(null);
    }
  };

  const txPhaseLabel =
    txPhase === "building"
      ? t("preparing")
      : txPhase === "signing"
        ? t("signing")
        : txPhase === "submitting"
          ? t("submitting")
          : txPhase === "confirming"
            ? t("confirming")
            : null;

  const hasChanges =
    minFundingGoal || maxFundingGoal || maxContributionPerTx || cancellationPenalty;

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
      <h3 className="text-xl font-bold mb-2">{t("limitsFees.title")}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        {t("limitsFees.subtitle")}
      </p>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-6"
      >
        {/* Min Funding Goal */}
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {t("limitsFees.minFundingGoal")}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {t("limitsFees.minFundingGoalHelp")}
          </p>
          <input
            type="number"
            min="0"
            value={minFundingGoal}
            onChange={(e) => setMinFundingGoal(e.target.value)}
            disabled={isUpdating}
            placeholder="e.g., 1000000000"
            className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none transition disabled:opacity-50"
          />
        </div>

        {/* Max Funding Goal */}
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {t("limitsFees.maxFundingGoal")}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {t("limitsFees.maxFundingGoalHelp")}
          </p>
          <input
            type="number"
            min="0"
            value={maxFundingGoal}
            onChange={(e) => setMaxFundingGoal(e.target.value)}
            disabled={isUpdating}
            placeholder="e.g., 100000000000"
            className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none transition disabled:opacity-50"
          />
        </div>

        {/* Max Contribution Per Tx */}
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {t("limitsFees.maxContributionPerTx")}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {t("limitsFees.maxContributionPerTxHelp")}
          </p>
          <input
            type="number"
            min="0"
            value={maxContributionPerTx}
            onChange={(e) => setMaxContributionPerTx(e.target.value)}
            disabled={isUpdating}
            placeholder="e.g., 50000000000"
            className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none transition disabled:opacity-50"
          />
        </div>

        {/* Cancellation Penalty */}
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {t("limitsFees.cancellationPenalty")}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {t("limitsFees.cancellationPenaltyHelp")}
          </p>
          <input
            type="number"
            min="0"
            max="10000"
            value={cancellationPenalty}
            onChange={(e) => setCancellationPenalty(e.target.value)}
            disabled={isUpdating}
            placeholder="e.g., 500"
            className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none transition disabled:opacity-50"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isUpdating || !hasChanges}
          className="w-full py-4 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 active:scale-95 transition disabled:opacity-50"
        >
          {isUpdating ? (
            <>
              <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
              {txPhaseLabel || t("awaitingSignature")}
            </>
          ) : (
            t("limitsFees.updateLimits")
          )}
        </button>
      </form>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-8 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              {t("limitsFees.title")}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              {t("limitsFees.confirmUpdate")}
            </p>

            {pendingChanges && (
              <div className="space-y-3 mb-8 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-sm">
                {pendingChanges.minFundingGoal !== undefined && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Min Goal</p>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {pendingChanges.minFundingGoal.toString()}
                    </p>
                  </div>
                )}
                {pendingChanges.maxFundingGoal !== undefined && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Max Goal</p>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {pendingChanges.maxFundingGoal.toString()}
                    </p>
                  </div>
                )}
                {pendingChanges.maxContributionPerTx !== undefined && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Max Per Tx</p>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {pendingChanges.maxContributionPerTx.toString()}
                    </p>
                  </div>
                )}
                {pendingChanges.cancellationPenalty !== undefined && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Penalty</p>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {pendingChanges.cancellationPenalty} bps
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsConfirmOpen(false);
                  setPendingChanges(null);
                }}
                disabled={isUpdating}
                className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl font-semibold hover:opacity-80 transition disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  void performUpdate();
                }}
                disabled={isUpdating}
                className="flex-1 py-3 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {isUpdating ? (
                  <Loader2 className="inline h-4 w-4 animate-spin" />
                ) : (
                  t("limitsFees.updateLimits")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
