"use client";

import { useTranslation } from "@/i18n/TranslationProvider";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {t("error.somethingWentWrong")}
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {error.message || t("error.failedToLoadGroups")}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-gold-400"
      >
        {t("error.tryAgain")}
      </button>
    </div>
  );
}
