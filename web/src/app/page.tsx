import { auth } from "@/lib/auth";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { getLocale } from "@/i18n/server";
import { getT } from "@/i18n";

const FEATURE_KEYS = [
  { icon: "⚽", titleKey: "home.featurePredictTitle", descKey: "home.featurePredictDesc" },
  { icon: "👥", titleKey: "home.featureGroupsTitle", descKey: "home.featureGroupsDesc" },
  { icon: "🏆", titleKey: "home.featureLeaderboardTitle", descKey: "home.featureLeaderboardDesc" },
  { icon: "🌍", titleKey: "home.featureLeaguesTitle", descKey: "home.featureLeaguesDesc" },
  { icon: "📊", titleKey: "home.featureScoringTitle", descKey: "home.featureScoringDesc" },
  { icon: "🔗", titleKey: "home.featureInvitesTitle", descKey: "home.featureInvitesDesc" },
];

export default async function Home() {
  const session = await auth();
  const locale = await getLocale();
  const t = getT(locale);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col font-sans">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center sm:py-32">
        <h1 className="text-3xl font-bold tracking-tight text-navy-800 sm:text-5xl dark:text-gold-400">
          {t("home.heading")}
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-navy-600 dark:text-navy-300">
          {t("home.description")}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-gold-400"
              >
                {t("home.goToDashboard")}
              </Link>
              <span className="text-sm text-navy-500 dark:text-navy-400">
                {t("home.welcomeBack", { name: session.user.name ?? session.user.email ?? "" })}
              </span>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="rounded-lg bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-gold-400"
              >
                {t("home.getStarted")}
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-navy-300 px-6 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-100 dark:border-navy-600 dark:text-navy-200 dark:hover:bg-navy-800"
              >
                {t("home.howItWorks")}
              </Link>
              <Link
                href="/groups/browse"
                className="rounded-lg border border-navy-300 px-6 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-100 dark:border-navy-600 dark:text-navy-200 dark:hover:bg-navy-800"
              >
                {t("home.browseGroups")}
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-navy-200/60 bg-navy-50 px-6 py-20 dark:border-navy-800 dark:bg-navy-900/50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-navy-800 dark:text-navy-100">
            {t("home.featuresHeading")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-navy-500 dark:text-navy-400">
            {t("home.featuresDescription")}
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_KEYS.map((f) => (
              <div
                key={f.titleKey}
                className="rounded-xl border border-navy-200/60 bg-white p-6 shadow-sm dark:border-navy-700 dark:bg-navy-800"
              >
                <span className="text-2xl" role="img" aria-label={t(f.titleKey)}>
                  {f.icon}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-navy-800 dark:text-navy-100">
                  {t(f.titleKey)}
                </h3>
                <p className="mt-1 text-sm leading-6 text-navy-500 dark:text-navy-400">
                  {t(f.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
