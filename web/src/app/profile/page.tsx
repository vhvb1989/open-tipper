import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  const { user } = session;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Profile
      </h1>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-6">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "User avatar"}
              width={80}
              height={80}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {user.name ?? "No name"}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {user.email ?? "No email"}
            </p>
          </div>
        </div>

        <dl className="mt-8 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Display name
            </dt>
            <dd className="text-sm text-zinc-900 dark:text-zinc-50">
              {user.name ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Email
            </dt>
            <dd className="text-sm text-zinc-900 dark:text-zinc-50">
              {user.email ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              User ID
            </dt>
            <dd className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
              {user.id}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Profile details are sourced from your OAuth provider and are read-only.
      </p>
    </div>
  );
}
