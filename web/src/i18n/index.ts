import en from "./en.json";
import es from "./es.json";

export type Locale = "en" | "es";
export const LOCALES: Locale[] = ["en", "es"];
export const DEFAULT_LOCALE: Locale = "en";

type Dictionary = typeof en;
const dictionaries: Record<Locale, Dictionary> = { en, es };

/** Walk a nested object by dot-separated key path */
function resolvePath(
  obj: Record<string, unknown>,
  path: string,
): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Build a translator function for the given locale.
 *
 * Supports:
 * - Dot-path keys: `t('nav.brand')` → "Open Tipper"
 * - Interpolation: `t('home.welcomeBack', { name: 'Vic' })` → "Welcome back, Vic!"
 * - Pipe-separated plurals: `t('dashboard.groupCount', { count: 2 })` → "2 groups"
 *   Format: `"{count} group | {count} groups"` — first form for count === 1, second otherwise
 */
export function getT(locale: Locale) {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];

  return function t(
    key: string,
    params?: Record<string, string | number>,
  ): string {
    let value = resolvePath(
      dict as unknown as Record<string, unknown>,
      key,
    );
    if (!value) return key;

    // Handle pipe-separated plurals when `count` or `n` param is present
    if (params && value.includes(" | ")) {
      const n = params.count ?? params.n;
      if (n !== undefined) {
        const forms = value.split(" | ");
        value = Number(n) === 1 ? forms[0] : (forms[1] ?? forms[0]);
      }
    }

    // Interpolate {param} placeholders
    if (params) {
      value = value.replace(
        /\{(\w+)\}/g,
        (_, k) => String(params[k] ?? `{${k}}`),
      );
    }

    return value;
  };
}

/** Re-export dictionaries for client-side provider */
export { dictionaries };
