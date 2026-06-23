"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n/TranslationProvider";

/**
 * "How does it work?" button + modal explaining the risk payout rules and
 * examples for each category. Opened from the risk panel header.
 */
export default function RiskRulesDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, close]);

  const sections: Array<{ icon: string; titleKey: string; rulesKey: string; exampleKey: string }> =
    [
      {
        icon: "⚑",
        titleKey: "predictions.riskRulesCornersTitle",
        rulesKey: "predictions.riskRulesCornersRules",
        exampleKey: "predictions.riskRulesCornersExample",
      },
      {
        icon: "🟨",
        titleKey: "predictions.riskRulesYellowTitle",
        rulesKey: "predictions.riskRulesCardsRules",
        exampleKey: "predictions.riskRulesYellowExample",
      },
      {
        icon: "🚫",
        titleKey: "predictions.riskRulesOffsidesTitle",
        rulesKey: "predictions.riskRulesCardsRules",
        exampleKey: "predictions.riskRulesOffsidesExample",
      },
    ];

  const modal = open ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("predictions.riskHowItWorks")}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("common.close")}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="pr-8 text-base font-bold text-zinc-900 dark:text-zinc-100">
          {t("predictions.riskHowItWorks")}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t("predictions.riskRulesIntro")}
        </p>

        <div className="mt-4 space-y-4">
          {sections.map((section) => (
            <div
              key={section.titleKey}
              className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden="true">{section.icon}</span>
                <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {t(section.titleKey)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                {t(section.rulesKey)}
              </p>
              <p className="mt-1 text-xs italic text-zinc-500 dark:text-zinc-400">
                {t(section.exampleKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100/60 px-2 py-0.5 text-[11px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
      >
        <span aria-hidden="true">ℹ️</span>
        {t("predictions.riskHowItWorks")}
      </button>
      {modal && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
