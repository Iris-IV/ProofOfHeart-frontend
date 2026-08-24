import { getTranslations } from "next-intl/server";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata() {
  const t = await getTranslations("Faq");
  const title = `${t("pageTitle")} | ProofOfHeart`;
  const description = t("pageSubtitle");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: buildAlternates("/faq"),
  };
}

export default async function FaqPage() {
  const t = await getTranslations("Faq");

  const sections = [
    {
      heading: t("sectionStellarTitle"),
      icon: "⭐",
      faqs: [
        { q: t("q_whatIsStellar"), a: t("a_whatIsStellar") },
        { q: t("q_whatIsSoroban"), a: t("a_whatIsSoroban") },
      ],
    },
    {
      heading: t("sectionCampaignsTitle"),
      icon: "🔍",
      faqs: [
        { q: t("q_howVerification"), a: t("a_howVerification") },
        { q: t("q_cancelledCampaign"), a: t("a_cancelledCampaign") },
        { q: t("q_platformFees"), a: t("a_platformFees") },
      ],
    },
    {
      heading: t("sectionStartupsTitle"),
      icon: "🚀",
      faqs: [{ q: t("q_revenueSharing"), a: t("a_revenueSharing") }],
    },
    {
      heading: t("sectionWalletTitle"),
      icon: "👛",
      faqs: [{ q: t("q_getFreighter"), a: t("a_getFreighter") }],
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 space-y-16">
      {/* Hero */}
      <section>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mb-4">
          {t("pageTitle")}
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {t("pageSubtitle")}
        </p>
      </section>

      {/* How it works summary */}
      <section className="rounded-2xl bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/10 dark:to-pink-900/10 border border-red-100 dark:border-red-900/20 p-8">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
          {t("howItWorksTitle")}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: "📝", title: t("step1Title"), body: t("step1Body") },
            { icon: "🗳️", title: t("step2Title"), body: t("step2Body") },
            { icon: "💸", title: t("step3Title"), body: t("step3Body") },
            { icon: "⛓️", title: t("step4Title"), body: t("step4Body") },
          ].map((step, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-xl border border-red-100 dark:border-red-900/30 bg-white/60 dark:bg-zinc-800/40 p-5"
            >
              <span className="text-2xl shrink-0">{step.icon}</span>
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

      {/* FAQ sections */}
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">
            <span className="text-2xl">{section.icon}</span>
            {section.heading}
          </h2>
          <dl className="space-y-4">
            {section.faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 p-6"
              >
                <dt className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">{faq.q}</dt>
                <dd
                  className="text-sm leading-6 text-zinc-600 dark:text-zinc-400"
                  dangerouslySetInnerHTML={{ __html: faq.a }}
                />
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
