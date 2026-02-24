import Link from "next/link";
import { Footer } from "@/components/Footer";

const STEPS = [
  {
    step: 1,
    icon: "📝",
    title: "Sign Up",
    description:
      "Create a free account with Google, GitHub, or email. No app downloads, no credit card — just sign in and you're ready to go.",
  },
  {
    step: 2,
    icon: "👥",
    title: "Create or Join a Group",
    description:
      "Start a private group and invite friends via a shareable link, or join an existing group someone sent you.",
  },
  {
    step: 3,
    icon: "⚽",
    title: "Pick a Competition",
    description:
      "Each group follows a real football league — Premier League, La Liga, Serie A, Liga MX, and more are available.",
  },
  {
    step: 4,
    icon: "🔮",
    title: "Predict Match Scores",
    description:
      "Before each match day, enter your predicted home and away scores for every fixture. Lock in your predictions before kick-off.",
  },
  {
    step: 5,
    icon: "📊",
    title: "Earn Points",
    description:
      "After matches finish, scores are updated automatically. You earn 3 points for an exact score prediction, or 1 point for predicting the correct outcome (win/draw/loss).",
  },
  {
    step: 6,
    icon: "🏆",
    title: "Climb the Leaderboard",
    description:
      "Your group's leaderboard updates in real time. Track your ranking, see how your mates are doing, and compete across the full season.",
  },
];

const SCORING_EXAMPLES = [
  {
    match: "Arsenal 2 – 1 Chelsea",
    prediction: "2 – 1",
    points: 3,
    reason: "Exact score",
  },
  {
    match: "Arsenal 2 – 1 Chelsea",
    prediction: "1 – 0",
    points: 1,
    reason: "Correct outcome (home win)",
  },
  {
    match: "Arsenal 2 – 1 Chelsea",
    prediction: "0 – 2",
    points: 0,
    reason: "Wrong outcome",
  },
];

export default function HowItWorks() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col font-sans">
      {/* Hero */}
      <section className="px-6 py-16 text-center sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight text-navy-800 sm:text-4xl dark:text-gold-400">
          How It Works
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-navy-600 dark:text-navy-300">
          Open Tipper is a free score-prediction game. Follow these six
          steps to start competing with friends.
        </p>
      </section>

      {/* Steps */}
      <section className="border-t border-navy-200/60 bg-navy-50 px-6 py-16 dark:border-navy-800 dark:bg-navy-900/50">
        <div className="mx-auto max-w-3xl space-y-10">
          {STEPS.map((s) => (
            <div key={s.step} className="flex gap-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-500 text-lg font-bold text-navy-900">
                {s.step}
              </div>
              <div>
                <h2 className="text-base font-semibold text-navy-800 dark:text-navy-100">
                  <span className="mr-2">{s.icon}</span>
                  {s.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-navy-500 dark:text-navy-400">
                  {s.description}
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
            Scoring Explained
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-navy-500 dark:text-navy-400">
            Points are awarded automatically after each match finishes.
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-200 dark:border-navy-700">
                  <th className="px-3 py-2 text-left font-semibold text-navy-700 dark:text-navy-200">
                    Actual Result
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-navy-700 dark:text-navy-200">
                    Your Prediction
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-navy-700 dark:text-navy-200">
                    Points
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-navy-700 dark:text-navy-200">
                    Why
                  </th>
                </tr>
              </thead>
              <tbody>
                {SCORING_EXAMPLES.map((ex, i) => (
                  <tr
                    key={i}
                    className="border-b border-navy-100 dark:border-navy-800"
                  >
                    <td className="px-3 py-3 text-navy-700 dark:text-navy-300">
                      {ex.match}
                    </td>
                    <td className="px-3 py-3 text-navy-700 dark:text-navy-300">
                      {ex.prediction}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-gold-600 dark:text-gold-400">
                      {ex.points}
                    </td>
                    <td className="px-3 py-3 text-navy-500 dark:text-navy-400">
                      {ex.reason}
                    </td>
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
          Ready to play?
        </h2>
        <p className="mt-2 text-sm text-navy-500 dark:text-navy-400">
          Sign up for free and start predicting today.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block rounded-lg bg-gold-500 px-6 py-3 text-sm font-semibold text-navy-900 shadow-sm transition-colors hover:bg-gold-400"
        >
          Get started
        </Link>
      </section>

      <Footer />
    </div>
  );
}
