"use client";

import { useTheme, THEMES, type ThemeName } from "./ThemeProvider";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Color Theme
      </h3>
      <div className="flex gap-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as ThemeName)}
            className={`group flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors ${
              theme === t.id
                ? "bg-gold-50 ring-2 ring-gold-500 dark:bg-navy-800 dark:ring-gold-400"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
            title={t.label}
          >
            {/* Swatch — navy circle with gold ring */}
            <div className="relative h-10 w-10 overflow-hidden rounded-full shadow-sm">
              <div
                className="absolute inset-0"
                style={{ backgroundColor: t.navy }}
              />
              <div
                className="absolute bottom-0 right-0 h-5 w-5 rounded-tl-full"
                style={{ backgroundColor: t.gold }}
              />
            </div>
            <span
              className={`text-xs font-medium ${
                theme === t.id
                  ? "text-gold-600 dark:text-gold-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
