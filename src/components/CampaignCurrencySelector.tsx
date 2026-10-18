"use client";

import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import Amount from "@/components/Amount";
import {
  exchangeRatesSchema,
  hasFreshRates,
  type DisplayCurrency,
  type ExchangeRates,
} from "@/lib/exchangeRates";
import { stroopsToXlmNumber } from "@/lib/stellarAmount";

type QuoteState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rates: ExchangeRates };

export default function CampaignCurrencySelector({ goal }: { goal: bigint }) {
  const t = useTranslations("CampaignCurrency");
  const locale = useLocale();
  const id = useId();
  const [currency, setCurrency] = useState<DisplayCurrency>("XLM");
  const [quote, setQuote] = useState<QuoteState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (currency === "XLM") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      setQuote({ status: "loading" });
      try {
        const response = await fetch("/api/exchange-rates", { signal: controller.signal });
        if (!response.ok) throw new Error("Quote unavailable");
        const rates = exchangeRatesSchema.parse(await response.json());
        if (!hasFreshRates(rates)) throw new Error("Quote expired");
        if (!controller.signal.aborted) setQuote({ status: "ready", rates });
      } catch {
        if (!controller.signal.aborted) setQuote({ status: "error" });
      }
      if (!controller.signal.aborted) {
        timer = setTimeout(() => {
          void load();
        }, 60_000);
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [currency, attempt]);

  const rate =
    quote.status === "ready"
      ? currency === "EUR"
        ? quote.rates.eur
        : quote.rates.usd
      : null;
  const fiat =
    rate === null
      ? null
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          currencyDisplay: "code",
        }).format(stroopsToXlmNumber(goal) * rate);

  return (
    <div className="min-w-0 rounded-surface border border-brand/20 bg-linear-to-br from-brand-subtle/70 via-white/80 to-accent-subtle/60 p-3 shadow-sm backdrop-blur-md dark:via-zinc-900/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {t("goal")}
        </label>
        <select
          id={id}
          value={currency}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setQuote({ status: "loading" });
            setCurrency(event.target.value as DisplayCurrency);
          }}
          className="tap-target focus-ring max-w-full rounded-control border border-brand/30 bg-white/80 px-3 text-sm font-medium text-zinc-900 shadow-sm transition-colors duration-[120ms] hover:border-brand motion-reduce:transition-none dark:bg-zinc-900/80 dark:text-zinc-50"
        >
          <option value="XLM">XLM</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-2 break-words text-sm text-zinc-900 dark:text-zinc-50"
      >
        {currency === "XLM" ? (
          <>
            <Amount value={goal} maximumFractionDigits={2} /> XLM
          </>
        ) : (
          <>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              <Amount value={goal} maximumFractionDigits={2} /> XLM
            </span>
            {quote.status === "loading"
              ? t("loading")
              : quote.status === "error"
                ? t("unavailable")
                : `≈ ${fiat}`}
          </>
        )}
      </div>
      {currency !== "XLM" && quote.status === "error" && (
        <Button variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>
          {t("retry")}
        </Button>
      )}
      <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {t("estimate")}
        {currency !== "XLM" && quote.status === "ready" && (
          <>
            {" "}
            {t("updated", {
              time: new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
              }).format(quote.rates.last_updated_at * 1000),
            })}{" "}
            <a className="focus-ring underline" href="https://www.coingecko.com/en/coins/stellar">
              CoinGecko
            </a>
          </>
        )}
      </p>
    </div>
  );
}
