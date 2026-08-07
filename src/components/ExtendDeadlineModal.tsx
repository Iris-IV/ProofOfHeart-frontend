"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ToastProvider";
import { extendCampaignDeadline } from "@/lib/contractClient";
import AsyncButtonContent from "@/components/AsyncButtonContent";
import { useWriteGuard } from "@/hooks/useWriteGuard";
import { withActionTimeout, getAsyncActionErrorMessage } from "@/utils/asyncAction";
import { parseContractError } from "@/utils/contractErrors";

interface ExtendDeadlineModalProps {
  campaignId: number;
  currentDeadline: number; // Unix timestamp in seconds
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ExtendDeadlineModal({
  campaignId,
  currentDeadline,
  onClose,
  onSuccess,
}: ExtendDeadlineModalProps) {
  const { showSuccess, showError } = useToast();
  const t = useTranslations("ExtendDeadline");
  const [additionalDays, setAdditionalDays] = useState<number | "">(1);
  const { invoke, isPending } = useWriteGuard();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isSubmitting = isPending("extendCampaignDeadline", campaignId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (additionalDays === "" || additionalDays < 1 || additionalDays > 30) {
      showError(t("validationError"));
      return;
    }

    await invoke("extendCampaignDeadline", campaignId, async () => {
      try {
        await withActionTimeout(extendCampaignDeadline(campaignId, additionalDays));
        showSuccess(t("successMessage"));
        if (onSuccess) onSuccess();
        onClose();
      } catch (err) {
        showError(getAsyncActionErrorMessage(err, parseContractError));
        throw err;
      }
    });
  };

  const newDeadlineTimestamp = currentDeadline + (additionalDays || 0) * 24 * 60 * 60;
  const newDeadlineDate = new Date(newDeadlineTimestamp * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extend-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <h2
            id="extend-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("description")}</p>

          <div>
            <label
              htmlFor="additional-days"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              {t("labelDays")} <span className="text-red-500">*</span>
            </label>
            <input
              id="additional-days"
              type="number"
              min="1"
              max="30"
              value={additionalDays}
              onChange={(e) => {
                const val = e.target.value;
                setAdditionalDays(val === "" ? "" : parseInt(val, 10));
              }}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
              {t("previewLabel")}
            </p>
            <p className="text-base text-blue-900 dark:text-blue-100 mt-1">{newDeadlineDate}</p>
          </div>

          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {t("warning")}
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting || additionalDays === "" || additionalDays < 1 || additionalDays > 30
              }
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:bg-zinc-400 flex justify-center items-center"
            >
              <AsyncButtonContent
                isPending={isSubmitting}
                idleLabel={t("submit")}
                pendingLabel={t("submitting")}
              />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
