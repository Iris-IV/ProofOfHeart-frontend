"use client";

import { useTranslations } from "next-intl";
import type { SocialLoginProvider } from "@/lib/socialWallet";

interface SocialLoginButtonsProps {
  /** Whether a Web3Auth client id is configured. */
  available: boolean;
  disabled?: boolean;
  onSelect: (provider: SocialLoginProvider) => void | Promise<void>;
  /** Invoked after `onSelect` settles, e.g. to close the surrounding modal. */
  onConnected?: () => void;
}

/**
 * Google / X sign-in that provisions an embedded Stellar wallet (#649).
 *
 * Deliberately presentational — it takes the wallet callbacks as props rather
 * than calling `useWallet()`, because `WalletContext` renders this through the
 * install modal and a `useWallet` import here would close an import cycle back
 * into the provider that defines it.
 *
 * Renders nothing unless social login is configured, so an unprovisioned
 * deployment shows the unchanged Freighter-only flow rather than buttons that
 * fail on click.
 */
export default function SocialLoginButtons({
  available,
  disabled = false,
  onSelect,
  onConnected,
}: SocialLoginButtonsProps) {
  const t = useTranslations("Common");

  if (!available) return null;

  const handleClick = async (provider: SocialLoginProvider) => {
    await onSelect(provider);
    onConnected?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("socialLoginDivider")}
        </span>
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <button
        type="button"
        onClick={() => handleClick("google")}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.56Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.9c-1.03.7-2.36 1.11-3.9 1.11-3 0-5.55-2.03-6.46-4.76H1.7v2.99A11.99 11.99 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.54 14.66a7.2 7.2 0 0 1 0-4.6V7.07H1.7a12 12 0 0 0 0 10.58l3.84-3Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.29-3.29C17.72 1.2 15.11 0 12 0 7.44 0 3.5 2.62 1.7 6.43l3.84 3C6.45 6.78 9 4.75 12 4.75Z"
          />
        </svg>
        {t("continueWithGoogle")}
      </button>

      <button
        type="button"
        onClick={() => handleClick("twitter")}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M18.9 1.9h3.4l-7.4 8.5L23.6 22h-6.8l-5.3-7-6.1 7H2l7.9-9.1L1.4 1.9h7l4.8 6.4 5.7-6.4Zm-1.2 18h1.9L7.4 3.8H5.4l12.3 16.1Z" />
        </svg>
        {t("continueWithX")}
      </button>

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">{t("socialLoginHint")}</p>
    </div>
  );
}
