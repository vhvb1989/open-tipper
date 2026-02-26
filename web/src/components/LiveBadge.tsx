"use client";

import { useTranslation } from "@/i18n/TranslationProvider";

/**
 * LiveBadge — pulsing red dot + "LIVE" text for matches currently in play.
 *
 * Usage:
 *   <LiveBadge status="IN_PLAY" />
 *   <LiveBadge status="PAUSED" />  // shows "HT" for halftime
 */

export function LiveBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  if (status === "IN_PLAY") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700 dark:bg-red-900/30 dark:text-red-400" role="status" aria-live="polite">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
        </span>
        {t("live.live")}
      </span>
    );
  }

  if (status === "PAUSED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" role="status">
        {t("live.ht")}
      </span>
    );
  }

  return null;
}
