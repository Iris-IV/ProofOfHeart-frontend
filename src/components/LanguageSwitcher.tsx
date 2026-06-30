"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useTransition } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const selectId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const liveRef = useRef<HTMLSpanElement>(null);

  const displayNames = useMemo(
    () =>
      new Intl.DisplayNames([locale], {
        type: "language",
      }),
    [locale],
  );

  const getLocaleLabel = (code: string) => displayNames.of(code) ?? code.toUpperCase();

  const currentLanguageLabel = getLocaleLabel(locale);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.textContent = t("currentLanguage", { language: currentLanguageLabel });
    }
  }, [currentLanguageLabel, t]);

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === locale) {
      return;
    }

    const nextLabel = getLocaleLabel(nextLocale);

    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });

    if (liveRef.current) {
      liveRef.current.textContent = t("languageChanged", { language: nextLabel });
    }

    requestAnimationFrame(() => {
      selectRef.current?.focus();
    });
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-zinc-700 dark:text-zinc-200">
      <Languages size={18} className={isPending ? "motion-safe:animate-pulse" : ""} aria-hidden />
      <label htmlFor={selectId} className="sr-only">
        {t("selectLanguage")}
      </label>
      <select
        ref={selectRef}
        id={selectId}
        value={locale}
        lang={locale}
        onChange={(event) => handleLocaleChange(event.target.value)}
        disabled={isPending}
        aria-label={t("currentLanguage", { language: currentLanguageLabel })}
        className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-white/10"
      >
        {routing.locales.map((availableLocale) => (
          <option key={availableLocale} value={availableLocale} lang={availableLocale}>
            {getLocaleLabel(availableLocale)}
          </option>
        ))}
      </select>
      <span ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />
    </div>
  );
}
