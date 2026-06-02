"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";

const STEP_KEYS = ["connect", "chooseCause", "contribute", "confirm"] as const;

export default function OnboardingTour() {
  const t = useTranslations("Onboarding");
  const { show, dismiss } = useOnboardingTour();
  const [step, setStep] = useState(0);

  if (!show) return null;

  const isLast = step === STEP_KEYS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("tourLabel")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-neutral-900">
        {/* Close */}
        <button
          onClick={dismiss}
          aria-label={t("skip")}
          className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          ✕
        </button>

        {/* Step indicators */}
        <div className="mb-6 flex justify-center gap-2" aria-hidden="true">
          {STEP_KEYS.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step ? "bg-rose-500" : "bg-neutral-300 dark:bg-neutral-600"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl">{t(`step_${STEP_KEYS[step]}_icon`)}</div>
          <h2 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">
            {t(`step_${STEP_KEYS[step]}_title`)}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t(`step_${STEP_KEYS[step]}_body`)}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={dismiss}
            className="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            {t("skip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium dark:border-neutral-700"
              >
                {t("back")}
              </button>
            )}
            <button
              onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
            >
              {isLast ? t("done") : t("next")}
            </button>
          </div>
        </div>

        {/* Progress label for screen readers */}
        <p className="sr-only">
          {t("stepProgress", { current: step + 1, total: STEP_KEYS.length })}
        </p>
      </div>
    </div>
  );
}
