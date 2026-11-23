"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import {
  setVotingParams,
} from "@/lib/contractClient";
import { parseContractError } from "@/utils/contractErrors";
import type { TransactionLifecyclePhase } from "@/lib/contractClient";
import { Loader2 } from "lucide-react";

export default function GovernanceSection() {
  const t = useTranslations("Admin");
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const [quorum, setQuorum] = useState("");
  const [threshold, setThreshold] = useState("");
  const [minVotingBalance, setMinVotingBalance] = useState("");
  const [categoryOverrides, setCategoryOverrides] = useState<Map<number, number>>(new Map());
  const [isUpdating, setIsUpdating] = useState(false);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingParams, setPendingParams] = useState<{
    quorum: number;
    threshold: number;
    minVotingBalance: bigint;
  } | null>(null);

  const validateInputs = (): boolean => {
    const q = Number(quorum);
    const th = Number(threshold);

    if (isNaN(q) || q < 1 || q > 1000) {
      showError(t("governance.quorumError"));
      return false;
    }

    if (isNaN(th) || th < 10 || th > 100) {
      showError(t("governance.thresholdError"));
      return false;
    }

    if (minVotingBalance && isNaN(Number(minVotingBalance))) {
      showError("Invalid minimum voting balance");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateInputs()) return;

    const q = Number(quorum);
    const th = Number(threshold);
    const mvb = minVotingBalance ? BigInt(minVotingBalance) : BigInt(0);

    setPendingParams({ quorum: q, threshold: th, minVotingBalance: mvb });
    setIsConfirmOpen(true);
  };

  const performUpdate = async () => {
    if (!pendingParams) return;

    setIsConfirmOpen(false);
    setIsUpdating(true);
    setTxPhase(null);

    try {
      const q = pendingParams.quorum;
      const th = pendingParams.threshold;

      const txHash = await setVotingParams(q, th, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });

      showSuccess(t("governance.governanceSuccess"));
      setQuorum("");
      setThreshold("");
      setMinVotingBalance("");
      setCategoryOverrides(new Map());

      await queryClient.invalidateQueries({ queryKey: ["platformStats"] });
    } catch (err) {
      showError(parseContractError(err));
    } finally {
      setIsUpdating(false);
      setTxPhase(null);
      setPendingParams(null);
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

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
      <h3 className="text-xl font-bold mb-2">{t("governance.title")}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        {t("governance.subtitle")}
      </p>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-6"
      >
        {/* Quorum */}
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {t("governance.quorum")}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {t("governance.quorumHelp")}
          </p>
          <input
            type="number"
            min="1"
            max="1000"
            value={quorum}
            onChange={(e) => setQuorum(e.target.value)}
            disabled={isUpdating}
            placeholder="e.g., 500"
            className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none transition disabled:opacity-50"
          />
        </div>

        {/* Threshold */}
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {t("governance.threshold")}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {t("governance.thresholdHelp")}
          </p>
          <input
            type="number"
            min="10"
            max="100"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={isUpdating}
            placeholder="e.g., 50"
            className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none transition disabled:opacity-50"
          />
        </div>

        {/* Min Voting Balance */}
        <div>
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {t("governance.minVotingBalance")}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            {t("governance.minVotingBalanceHelp")}
          </p>
          <input
            type="number"
            min="0"
            value={minVotingBalance}
            onChange={(e) => setMinVotingBalance(e.target.value)}
            disabled={isUpdating}
            placeholder="e.g., 1000000000"
            className="w-full bg-zinc-50 dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 rounded-2xl px-5 py-4 font-bold text-zinc-900 dark:text-zinc-50 focus:border-amber-500 focus:outline-none transition disabled:opacity-50"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isUpdating || !quorum || !threshold}
          className="w-full py-4 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 active:scale-95 transition disabled:opacity-50"
        >
          {isUpdating ? (
            <>
              <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
              {txPhaseLabel || t("awaitingSignature")}
            </>
          ) : (
            t("governance.updateParams")
          )}
        </button>
      </form>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-8 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              {t("governance.title")}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              {t("governance.confirmUpdate")}
            </p>

            {pendingParams && (
              <div className="space-y-3 mb-8 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Quorum</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {pendingParams.quorum} (0.{String(pendingParams.quorum).padStart(2, "0")}%)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Threshold</p>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {pendingParams.threshold}%
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsConfirmOpen(false);
                  setPendingParams(null);
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
                  t("governance.updateParams")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
