import { getTranslations } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("About");
  return {
    title: t("pageTitle"),
    alternates: buildAlternates("/about"),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("About");

  const steps = [
    { title: t("step1Title"), body: t("step1Body"), icon: "📝" },
    { title: t("step2Title"), body: t("step2Body"), icon: "🗳️" },
    { title: t("step3Title"), body: t("step3Body"), icon: "💸" },
    { title: t("step4Title"), body: t("step4Body"), icon: "⛓️" },
  ];

  const faqs = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
    { q: t("faq4Q"), a: t("faq4A") },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 space-y-20">
      {/* Hero */}
      <section>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mb-4">
          {t("pageTitle")}
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {t("pageSubtitle")}
        </p>
      </section>

      {/* What is ProofOfHeart */}
      <section>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          {t("whatIsTitle")}
        </h2>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">{t("whatIsBody")}</p>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-8">
          {t("howItWorksTitle")}
        </h2>
        <ol className="grid gap-6 sm:grid-cols-2">
          {steps.map((step, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 p-6"
            >
              <span className="text-3xl shrink-0">{step.icon}</span>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Who can participate */}
      <section className="rounded-2xl bg-linear-to-br from-red-50 to-pink-50 dark:from-red-900/10 dark:to-pink-900/10 border border-red-100 dark:border-red-900/20 p-8">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          {t("whoCanTitle")}
        </h2>
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">{t("whoCanBody")}</p>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-8">
          {t("faqTitle")}
        </h2>
        <dl className="space-y-6">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 p-6"
            >
              <dt className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{faq.q}</dt>
              <dd className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
