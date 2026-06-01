import { describe, it, expect } from "vitest";
import { matchAcceptLanguage } from "./index";

describe("matchAcceptLanguage", () => {
  it("returns exact locale match", () => {
    expect(matchAcceptLanguage("en")).toBe("en");
    expect(matchAcceptLanguage("es")).toBe("es");
  });

  it("returns locale from regional variant (e.g. es-MX → es)", () => {
    expect(matchAcceptLanguage("es-MX")).toBe("es");
    expect(matchAcceptLanguage("en-US")).toBe("en");
    expect(matchAcceptLanguage("es-AR")).toBe("es");
  });

  it("respects quality values and picks highest match", () => {
    expect(matchAcceptLanguage("es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("es");
    expect(matchAcceptLanguage("en-US;q=0.9,es;q=0.5")).toBe("en");
  });

  it("picks first supported locale when multiple have equal quality", () => {
    expect(matchAcceptLanguage("fr,es,en")).toBe("es");
  });

  it("returns null when no supported locale matches", () => {
    expect(matchAcceptLanguage("fr,de,ja")).toBeNull();
    expect(matchAcceptLanguage("zh-CN")).toBeNull();
  });

  it("handles empty string", () => {
    expect(matchAcceptLanguage("")).toBeNull();
  });

  it("handles wildcard (*)", () => {
    // Wildcard alone should not match any specific locale
    expect(matchAcceptLanguage("*")).toBeNull();
  });

  it("handles complex real-world Accept-Language headers", () => {
    // Typical Mexican Chrome browser
    expect(matchAcceptLanguage("es-419,es;q=0.9,en;q=0.8")).toBe("es");
    // Typical US browser with Spanish as secondary
    expect(matchAcceptLanguage("en-US,en;q=0.9,es;q=0.8")).toBe("en");
  });
});
