import { auth } from "@/lib/auth";
import Link from "next/link";
import { Footer } from "@/components/Footer";

const FEATURES = [
  {
    icon: "⚽",
    title: "Predict Scores",
    description:
      "Enter your predicted score for every match — exact scores earn the most points.",
  },
  {
    icon: "👥",
    title: "Create Groups",
    description:
      "Set up private groups for friends, family, or co-workers and compete head-to-head.",
  },
  {
    icon: "🏆",
    title: "Climb Leaderboards",
    description:
      "Track your ranking in real-time leaderboards updated automatically after each match day.",
  },
  {
    icon: "🌍",
    title: "Multiple Leagues",
    description:
      "Follow the Premier League, La Liga, Serie A, Liga MX, and more — all in one place.",
  },
  {
    icon: "📊",
    title: "Smart Scoring",
    description:
      "Earn 3 points for an exact score, 1 for the correct outcome. Strategy matters.",
  },
  {
    icon: "🔗",
    title: "Easy Invites",
    description:
      "Share an invite link and friends can join your group in seconds — no app download needed.",
  },
];

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col font-sans">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center sm:py-32">
        <h1 className="text-3xl font-bold tracking-tight text-navy-800 sm:text-5xl dark:text-gold-400">
          Open Tipper
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-navy-600 dark:text-navy-300">
          Score prediction with your mates — predict football match scores and
          compete on leaderboards with friends, family, or co-workers.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-gold-400"
              >
                Go to dashboard
              </Link>
              <span className="text-sm text-navy-500 dark:text-navy-400">
                Welcome back, {session.user.name ?? session.user.email}!
              </span>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="rounded-lg bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-gold-400"
              >
                Get started
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-navy-300 px-6 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-100 dark:border-navy-600 dark:text-navy-200 dark:hover:bg-navy-800"
              >
                How it works
              </Link>
              <Link
                href="/groups/browse"
                className="rounded-lg border border-navy-300 px-6 py-3 text-sm font-semibold text-navy-700 transition-colors hover:bg-navy-100 dark:border-navy-600 dark:text-navy-200 dark:hover:bg-navy-800"
              >
                Browse groups
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-navy-200/60 bg-navy-50 px-6 py-20 dark:border-navy-800 dark:bg-navy-900/50">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-navy-800 dark:text-navy-100">
            Everything you need to compete
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-navy-500 dark:text-navy-400">
            Set up a group, invite your mates, and start predicting. It&apos;s
            free and takes less than a minute.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-navy-200/60 bg-white p-6 shadow-sm dark:border-navy-700 dark:bg-navy-800"
              >
                <span className="text-2xl" role="img" aria-label={f.title}>
                  {f.icon}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-navy-800 dark:text-navy-100">
                  {f.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-navy-500 dark:text-navy-400">
                  {f.description}
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
