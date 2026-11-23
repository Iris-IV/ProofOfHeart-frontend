"use client";

import { FormEvent, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { useCampaigns } from "@/hooks/useCampaigns";
import { verifyCampaigns } from "@/lib/contractClient";
import { parseContractError } from "@/utils/contractErrors";
import type { TransactionLifecyclePhase } from "@/lib/contractClient";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function BatchVerificationSection() {
  const t = useTranslations("Admin");
  const { showSuccess, showError } = useToast();
  const { campaigns } = useCampaigns();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isVerifying, setIsVerifying] = useState(false);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const [result, setResult] = useState<{ verified: number[]; failed: number[] } | null>(null);

  const pendingCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === "pending"),
    [campaigns],
  );

  const handleToggleSelect = (campaignId: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(campaignId)) {
      newSet.delete(campaignId);
    } else {
      if (newSet.size >= 50) {
        showError(t("batchVerification.maxBatch"));
        return;
      }
      newSet.add(campaignId);
    }
    setSelectedIds(newSet);
  };

  const handleVerifySelected = async (e: FormEvent) => {
    e.preventDefault();

    if (selectedIds.size === 0) {
      showError(t("batchVerification.noSelected"));
      return;
    }

    setIsVerifying(true);
    setTxPhase(null);
    setResult(null);

    try {
      const campaignIds = Array.from(selectedIds);
      const txResult = await verifyCampaigns(campaignIds, {
        onStatus: ({ phase }) => setTxPhase(phase),
      });

      setResult({ verified: txResult.verified, failed: txResult.failed });

      if (txResult.failed.length === 0) {
        showSuccess(
          t("batchVerification.verifySuccess", { count: txResult.verified.length }),
        );
      } else {
        showSuccess(
          t("batchVerification.verifyPartial", {
            verified: txResult.verified.length,
            total: campaignIds.length,
          }),
        );
      }

      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    } catch (err) {
      showError(parseContractError(err));
      setResult(null);
    } finally {
      setIsVerifying(false);
      setTxPhase(null);
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
      <h3 className="text-xl font-bold mb-2">{t("batchVerification.title")}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        {t("batchVerification.description")}
      </p>

      {pendingCampaigns.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("noPending")}</p>
      ) : (
        <form
          onSubmit={(e) => {
            void handleVerifySelected(e);
          }}
          className="space-y-6"
        >
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {pendingCampaigns.map((campaign) => (
              <label key={campaign.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(campaign.id)}
                  onChange={() => handleToggleSelect(campaign.id)}
                  disabled={isVerifying}
                  className="w-5 h-5 rounded border-2 border-zinc-300 dark:border-zinc-600 cursor-pointer disabled:opacity-50"
                />
                <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Campaign {campaign.id}: {campaign.title}
                </span>
              </label>
            ))}
          </div>

          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {selectedIds.size > 0 && (
              <>
                <p className="font-medium mb-2">
                  {t("batchVerification.verifyCount", { count: selectedIds.size })}
                </p>
                <p className="text-xs">{t("batchVerification.maxBatch")}</p>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={isVerifying || selectedIds.size === 0}
            className="w-full py-4 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 active:scale-95 transition disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
                {txPhaseLabel || t("awaitingSignature")}
              </>
            ) : (
              t("batchVerification.verifySelected")
            )}
          </button>

          {result && (
            <div className="mt-6 space-y-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("batchVerification.verifySuccess", {
                      count: result.verified.length,
                    })}
                  </p>
                  {result.verified.length > 0 && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      IDs: {result.verified.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {result.failed.length > 0 && (
                <div className="flex items-start gap-3 mt-3">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("batchVerification.verifyFailed", { count: result.failed.length })}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      {t("batchVerification.failedIds", { ids: result.failed.join(", ") })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </section>
  );
}
