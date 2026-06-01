import { cookies, headers } from "next/headers";
import type { Locale } from "./index";
import { LOCALES, DEFAULT_LOCALE, matchAcceptLanguage } from "./index";

/**
 * Read the user's preferred locale.
 *
 * Priority:
 * 1. `locale` cookie (explicit user choice)
 * 2. Browser's Accept-Language header (auto-detect on first visit)
 * 3. DEFAULT_LOCALE ("en")
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value as Locale | undefined;
  if (raw && LOCALES.includes(raw)) return raw;

  // No cookie — try browser language
  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    const detected = matchAcceptLanguage(acceptLanguage);
    if (detected) return detected;
  }

  return DEFAULT_LOCALE;
}
