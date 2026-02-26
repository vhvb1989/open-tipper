import Link from "next/link";
import { Footer } from "@/components/Footer";
import { getLocale } from "@/i18n/server";
import { getT } from "@/i18n";

const STEP_KEYS = [
  { step: 1, icon: "📝", titleKey: "howItWorks.step1Title", descKey: "howItWorks.step1Desc" },
  { step: 2, icon: "👥", titleKey: "howItWorks.step2Title", descKey: "howItWorks.step2Desc" },
  { step: 3, icon: "⚽", titleKey: "howItWorks.step3Title", descKey: "howItWorks.step3Desc" },
  { step: 4, icon: "🔮", titleKey: "howItWorks.step4Title", descKey: "howItWorks.step4Desc" },
  { step: 5, icon: "📊", titleKey: "howItWorks.step5Title", descKey: "howItWorks.step5Desc" },
  { step: 6, icon: "🏆", titleKey: "howItWorks.step6Title", descKey: "howItWorks.step6Desc" },
];

export default async function HowItWorks() {
  const locale = await getLocale();
  const t = getT(locale);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col font-sans">
      {/* Hero */}
      <section className="px-6 py-16 text-center sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight text-navy-800 sm:text-4xl dark:text-gold-400">
          {t("howItWorks.heading")}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-navy-600 dark:text-navy-300">
          {t("howItWorks.description")}
        </p>
      </section>

      {/* Steps */}
      <section className="border-t border-navy-200/60 bg-navy-50 px-6 py-16 dark:border-navy-800 dark:bg-navy-900/50">
        <div className="mx-auto max-w-3xl space-y-10">
          {STEP_KEYS.map((s) => (
            <div key={s.step} className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500 text-lg font-bold text-navy-900">
                {s.step}
              </div>
              <div>
                <h2 className="text-base font-semibold text-navy-800 dark:text-navy-100">
                  <span className="mr-2">{s.icon}</span>
                  {t(s.titleKey)}
                </h2>
                <p className="mt-1 text-sm leading-6 text-navy-500 dark:text-navy-400">
                  {t(s.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring breakdown */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-navy-800 dark:text-navy-100">
            {t("howItWorks.scoringHeading")}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-navy-500 dark:text-navy-400">
            {t("howItWorks.scoringDesc")}
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 dark:border-navy-700">
                  <th className="px-3 py-2 text-left font-semibold text-navy-700 dark:text-navy-200">
                    {t("howItWorks.tableActualResult")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-navy-700 dark:text-navy-200">
                    {t("howItWorks.tableYourPrediction")}
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-navy-700 dark:text-navy-200">
                    {t("howItWorks.tablePoints")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-navy-700 dark:text-navy-200">
                    {t("howItWorks.tableWhy")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    match: t("howItWorks.exampleMatch"),
                    prediction: t("howItWorks.examplePred1"),
                    points: 3,
                    reason: t("howItWorks.exampleWhy1"),
                  },
                  {
                    match: t("howItWorks.exampleMatch"),
                    prediction: t("howItWorks.examplePred2"),
                    points: 1,
                    reason: t("howItWorks.exampleWhy2"),
                  },
                  {
                    match: t("howItWorks.exampleMatch"),
                    prediction: t("howItWorks.examplePred3"),
                    points: 0,
                    reason: t("howItWorks.exampleWhy3"),
                  },
                ].map((ex, i) => (
                  <tr key={i} className="border-b border-navy-100 dark:border-navy-800">
                    <td className="px-3 py-3 text-navy-700 dark:text-navy-300">{ex.match}</td>
                    <td className="px-3 py-3 text-navy-700 dark:text-navy-300">{ex.prediction}</td>
                    <td className="px-3 py-3 text-center font-bold text-gold-600 dark:text-gold-400">
                      {ex.points}
                    </td>
                    <td className="px-3 py-3 text-navy-500 dark:text-navy-400">{ex.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-navy-200/60 bg-navy-50 px-6 py-16 text-center dark:border-navy-800 dark:bg-navy-900/50">
        <h2 className="text-xl font-bold text-navy-800 dark:text-navy-100">
          {t("howItWorks.ctaHeading")}
        </h2>
        <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">
          {t("howItWorks.ctaDescription")}
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block rounded-lg bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-gold-400"
        >
          {t("howItWorks.ctaGetStarted")}
        </Link>
      </section>

      <Footer />
    </div>
  );
}
