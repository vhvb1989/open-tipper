import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import en from "@/i18n/en.json";

// Simple dot-path resolver for test translations
function resolve(key: string): string {
  const parts = key.split(".");
  let cur: unknown = en;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key; // fallback to key
    }
  }
  return typeof cur === "string" ? cur : key;
}

function testT(key: string, params?: Record<string, unknown>): string {
  let val = resolve(key);
  // Handle pipe-separated plurals
  if (val.includes(" | ") && params && "count" in params) {
    const forms = val.split(" | ");
    val = Number(params.count) === 1 ? forms[0] : forms[1];
  }
  // Interpolate {param}
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return val;
}

// Mock i18n TranslationProvider so client components get real English translations
vi.mock("@/i18n/TranslationProvider", () => ({
  useTranslation: () => ({ locale: "en" as const, setLocale: () => {}, t: testT }),
  TranslationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock i18n server module
vi.mock("@/i18n/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));
