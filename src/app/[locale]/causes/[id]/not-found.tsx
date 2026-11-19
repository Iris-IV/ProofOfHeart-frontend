import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function CauseNotFound() {
  const t = await getTranslations("Accessibility");
  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800">
      <main className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-6xl">🔍</div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t("causeNotFound")}</h1>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t("causeNotFoundDescription")}
          </p>
          <Link
            href="/causes"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors"
          >
            {t("backToCauses")}
          </Link>
        </div>
      </main>
    </div>
  );
}
