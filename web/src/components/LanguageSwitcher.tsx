"use client";

import { useTranslation } from "@/i18n/TranslationProvider";
import { LOCALES, type Locale } from "@/i18n";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {t("language.heading")}
      </h3>
      <div className="flex gap-2" role="radiogroup" aria-label={t("language.heading")}>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={locale === l}
            onClick={() => setLocale(l)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              locale === l
                ? "border-gold-500 bg-gold-500/10 text-gold-600 dark:text-gold-400"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
