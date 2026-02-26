import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { ThemeSelector } from "@/components/ThemeSelector";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getLocale } from "@/i18n/server";
import { getT } from "@/i18n";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  const { user } = session;
  const locale = await getLocale();
  const t = getT(locale);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {t("profile.heading")}
      </h1>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-6">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? t("nav.userAvatar")}
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
              {user.name ?? t("profile.noName")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {user.email ?? t("profile.noEmail")}
            </p>
          </div>
        </div>

        <dl className="mt-8 space-y-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t("profile.displayName")}
            </dt>
            <dd className="text-sm text-zinc-900 dark:text-zinc-50">
              {user.name ?? t("profile.emptyValue")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t("profile.email")}
            </dt>
            <dd className="text-sm text-zinc-900 dark:text-zinc-50">
              {user.email ?? t("profile.emptyValue")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t("profile.userId")}
            </dt>
            <dd className="truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">
              {user.id}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        {t("profile.readOnlyNote")}
      </p>

      {/* Theme Picker */}
      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <ThemeSelector />
      </div>

      {/* Language Picker */}
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
