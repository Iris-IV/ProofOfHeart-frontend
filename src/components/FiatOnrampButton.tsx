"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  buildFiatOnrampUrl,
  getFiatOnrampProvider,
  getFiatOnrampProviderLabel,
} from "@/lib/fiatOnramp";

interface FiatOnrampButtonProps {
  /** Wallet address the purchased XLM is deposited into. */
  walletAddress?: string | null;
  /** Optional fiat amount hint passed to the provider. */
  fiatAmount?: number | null;
  className?: string;
}

/**
 * #637 — Entry point into a fiat-to-crypto on-ramp.
 *
 * Renders nothing unless a provider (Ramp/MoonPay) is configured via env vars.
 * Opens the provider's hosted checkout in a new tab, showing loading state
 * while it opens and an inline error if the popup is blocked or the URL cannot
 * be built.
 */
export default function FiatOnrampButton({
  walletAddress,
  fiatAmount,
  className,
}: FiatOnrampButtonProps) {
  const t = useTranslations("FiatOnramp");
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = getFiatOnrampProvider();
  if (!provider) return null;

  const handleClick = () => {
    setError(null);
    setIsOpening(true);
    try {
      const url = buildFiatOnrampUrl({ walletAddress, fiatAmount });
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        setError(t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className={className}>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <CreditCard size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {t("buyWithCard")}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {t("buyWithCardDescription")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClick}
          disabled={isOpening}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-100 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isOpening ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              {t("opening")}
            </>
          ) : (
            <>
              <ExternalLink size={16} aria-hidden="true" />
              {t("buyWithCard")}
            </>
          )}
        </button>

        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-500">
            {error}
          </p>
        ) : (
          <p className="mt-2 text-center text-[11px] text-zinc-400 dark:text-zinc-500">
            {t("poweredBy", { provider: getFiatOnrampProviderLabel(provider) })}
          </p>
        )}
      </div>
    </div>
  );
}
