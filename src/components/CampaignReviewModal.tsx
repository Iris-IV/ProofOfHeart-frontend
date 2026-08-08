"use client";

import { useTranslations } from "next-intl";
import { CATEGORY_LABELS } from "@/types";
import type { ReviewData } from "@/lib/campaignValidation";
import type { TransactionLifecyclePhase } from "@/lib/contractClient";

interface CampaignReviewModalProps {
  reviewData: ReviewData;
  isSubmitting: boolean;
  txPhase: TransactionLifecyclePhase | null;
  onClose: () => void;
  onConfirm: () => void;
  /** Formats a Unix timestamp into a human-readable date string. */
  formatReviewDate: (timestamp: number) => string;
}

export default function CampaignReviewModal({
  reviewData,
  isSubmitting,
  txPhase,
  onClose,
  onConfirm,
  formatReviewDate,
}: CampaignReviewModalProps) {
  const t = useTranslations("CreateCampaign");

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-review-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-700">
          <h2
            id="campaign-review-title"
            className="text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {t("reviewTitle")}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{t("reviewSubtitle")}</p>
        </div>

        <dl className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("reviewFieldTitle")}
            </dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
              {reviewData.title}
            </dd>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("reviewFieldCreatorEmail")}
            </dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
              {reviewData.creatorEmail || t("reviewCreatorEmailNone")}
            </dd>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
              <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t("reviewFieldFundingGoal")}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                {reviewData.fundingGoalXlm.toLocaleString(undefined, {
                  maximumFractionDigits: 7,
                })}{" "}
                XLM
              </dd>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
              <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t("reviewFieldDuration")}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                {t("reviewFieldDurationDays", { count: reviewData.durationDays })}
              </dd>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
              <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t("reviewFieldCategory")}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                {CATEGORY_LABELS[reviewData.category]}
              </dd>
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
              <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t("reviewFieldRevenueShare")}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
                {reviewData.hasRevenueSharing
                  ? `${reviewData.revenueSharePercentage.toFixed(2)}%`
                  : t("reviewRevenueShareNone")}
              </dd>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("reviewFieldEndDate")}
            </dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-1">
              {formatReviewDate(reviewData.estimatedDeadlineTimestamp)}
            </dd>
          </div>

          {reviewData.tags.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
              <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {t("reviewFieldTags")}
              </dt>
              <dd className="flex flex-wrap gap-2 mt-1.5">
                {reviewData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold border border-zinc-300 dark:border-zinc-600"
                  >
                    #{tag}
                  </span>
                ))}
              </dd>
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("reviewFieldTimestamp")}
            </dt>
            <dd className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1 tabular-nums">
              {reviewData.estimatedDeadlineTimestamp}
            </dd>
          </div>
        </dl>

        <div className="px-6 py-5 border-t border-zinc-200 dark:border-zinc-700 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("editDetails")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting && (
              <span className="inline-block motion-safe:animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            )}
            {isSubmitting
              ? txPhase === "building"
                ? t("submitting")
                : txPhase === "signing"
                  ? "Signing…"
                  : txPhase === "confirming"
                    ? "Confirming…"
                    : t("submitting")
              : t("confirmAndSign")}
          </button>
        </div>
      </div>
    </div>
  );
}
