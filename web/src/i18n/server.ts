import { cookies } from "next/headers";
import type { Locale } from "./index";
import { LOCALES, DEFAULT_LOCALE } from "./index";

/** Read the user's preferred locale from the `locale` cookie (server-side only). */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value as Locale | undefined;
  return raw && LOCALES.includes(raw) ? raw : DEFAULT_LOCALE;
}
