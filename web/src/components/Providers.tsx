"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "./ThemeProvider";
import { TranslationProvider } from "@/i18n/TranslationProvider";
import type { Locale } from "@/i18n";

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TranslationProvider locale={locale}>
        <ThemeProvider>{children}</ThemeProvider>
      </TranslationProvider>
    </SessionProvider>
  );
}
