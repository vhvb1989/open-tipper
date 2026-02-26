"use client";

import { useTheme, THEMES, type ThemeName } from "./ThemeProvider";
import { useTranslation } from "@/i18n/TranslationProvider";

const THEME_KEYS: Record<string, string> = {
  classic: "theme.classic",
  midnight: "theme.midnight",
  deep: "theme.deepBlue",
  steel: "theme.steel",
};

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {t("theme.heading")}
      </h3>
      <div className="flex flex-wrap gap-3">
        {THEMES.map((th) => (
          <button
            key={th.id}
            onClick={() => setTheme(th.id as ThemeName)}
            className={`group flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors ${
              theme === th.id
                ? "bg-gold-50 ring-2 ring-gold-500 dark:bg-navy-800 dark:ring-gold-400"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
            title={t(THEME_KEYS[th.id] ?? th.label)}
          >
            {/* Swatch — navy circle with gold ring */}
            <div className="relative h-10 w-10 overflow-hidden rounded-full shadow-sm">
              <div
                className="absolute inset-0"
                style={{ backgroundColor: th.navy }}
              />
              <div
                className="absolute bottom-0 right-0 h-5 w-5 rounded-tl-full"
                style={{ backgroundColor: th.gold }}
              />
            </div>
            <span
              className={`text-xs font-medium ${
                theme === th.id
                  ? "text-gold-600 dark:text-gold-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {t(THEME_KEYS[th.id] ?? th.label)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
