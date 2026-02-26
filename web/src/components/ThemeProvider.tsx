"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeName = "classic" | "midnight" | "deep" | "steel";

export const THEMES: { id: ThemeName; label: string; navy: string; gold: string }[] = [
  { id: "classic", label: "Classic", navy: "#1e2a4a", gold: "#c9a84c" },
  { id: "midnight", label: "Midnight", navy: "#1b2640", gold: "#b8973a" },
  { id: "deep", label: "Deep Blue", navy: "#1f3055", gold: "#d4a545" },
  { id: "steel", label: "Steel", navy: "#243352", gold: "#c4a35a" },
];

const ThemeContext = createContext<{
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
}>({ theme: "classic", setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme") as ThemeName | null;
      if (saved && THEMES.some((t) => t.id === saved)) return saved;
    }
    return "classic";
  });

  useEffect(() => {
    // Sync theme to DOM on mount and when theme changes
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
    document.documentElement.dataset.theme = t;
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
