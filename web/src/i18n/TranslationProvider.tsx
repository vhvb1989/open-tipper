"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { Locale } from "./index";
import { LOCALES, DEFAULT_LOCALE, getT } from "./index";

interface TranslationContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const TranslationContext = createContext<TranslationContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export function useTranslation() {
  return useContext(TranslationContext);
}

export function TranslationProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    if (!LOCALES.includes(l)) return;
    setLocaleState(l);
    document.cookie = `locale=${l};path=/;max-age=31536000`;
    // Update the html lang attribute
    document.documentElement.lang = l;
  }, []);

  const t = useMemo(() => getT(locale), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}
