import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-8 px-8 py-32 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Sport Predictor
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Score prediction with your mates — predict football match scores and
          compete on leaderboards with friends, family, or co-workers.
        </p>
        {session?.user ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Welcome back, {session.user.name ?? session.user.email}!
            </p>
            <Link
              href="/dashboard"
              className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <Link
            href="/signin"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Get started
          </Link>
        )}
      </main>
    </div>
  );
}
