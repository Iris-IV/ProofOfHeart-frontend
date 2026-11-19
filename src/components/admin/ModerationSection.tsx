"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import {
  adminCancelCampaign,
  censureComment,
  getCensuredCommentCount,
} from "@/lib/contractClient";
import { parseContractError } from "@/utils/contractErrors";
import type { TransactionLifecyclePhase } from "@/lib/contractClient";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function ModerationSection() {
  const t = useTranslations("Admin");
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

  const [censuredCount, setCensuredCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [txPhase, setTxPhase] = useState<TransactionLifecyclePhase | null>(null);
  const [showHideCensured, setShowHideCensured] = useState(true);

  useEffect(() => {
    loadCensuredCount();
  }, []);

  const loadCensuredCount = async () => {
    try {
      const count = await getCensuredCommentCount();
      setCensuredCount(count);
    } catch (err) {
      console.warn("Failed to load censured comment count:", err);
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
      <h3 className="text-xl font-bold mb-2">{t("moderation.title")}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
        Manage campaign cancellations and comment censure actions.
      </p>

      <div className="space-y-6">
        {/* Censured Comments Status */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t("moderation.censuredComments", { count: censuredCount })}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Comments hidden from public view
              </p>
            </div>
            <button
              onClick={() => setShowHideCensured(!showHideCensured)}
              className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
              title={showHideCensured ? t("moderation.hideCensured") : t("moderation.showCensured")}
            >
              {showHideCensured ? (
                <EyeOff className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              ) : (
                <Eye className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <span className="font-semibold">Note:</span> Comment censure and campaign cancellation
            actions are managed through the admin report queue. Use those controls to enforce
            moderation decisions.
          </p>
        </div>

        {/* Features Info */}
        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t("moderation.cancelCampaign")}
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Cancel any campaign from the admin report queue. This prevents further contributions
              and notifies the creator.
            </p>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t("moderation.censureComment")}
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Hide inappropriate comments from public view. Censured comments remain on-chain but
              are not displayed in the UI.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
