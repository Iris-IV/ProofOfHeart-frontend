"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { useMemo, useTransition } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { routing } from "@/i18n/routing";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const displayNames = useMemo(
    () =>
      new Intl.DisplayNames([locale], {
        type: "language",
      }),
    [locale],
  );

  const getLocaleLabel = (code: string) => {
    return displayNames.of(code) ?? code.toUpperCase();
  };

  const handleLocaleChange = (nextLocale: string) => {
    if (nextLocale === locale) {
      return;
    }

    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

  return (
    <label className="flex items-center gap-2 px-2 py-1.5 rounded-md text-zinc-700 dark:text-zinc-200">
      <Languages size={18} className={isPending ? "motion-safe:animate-pulse" : ""} />
      <span className="sr-only">Select language</span>
      <select
        value={locale}
        onChange={(event) => handleLocaleChange(event.target.value)}
        disabled={isPending}
        aria-label="Select language"
        className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-white/10"
      >
        {routing.locales.map((availableLocale) => (
          <option key={availableLocale} value={availableLocale}>
            {getLocaleLabel(availableLocale)}
          </option>
        ))}
      </select>
    </label>
  );
}
