import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/TranslationProvider", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "common.close": "Close",
        "predictions.riskHowItWorks": "How does it work?",
        "predictions.riskRulesIntro": "Risk points on match stats.",
        "predictions.riskRulesCornersTitle": "Corner kicks",
        "predictions.riskRulesCornersRules": "Exact = 3×.",
        "predictions.riskRulesCornersExample": "Example corners.",
        "predictions.riskRulesYellowTitle": "Yellow cards",
        "predictions.riskRulesOffsidesTitle": "Offsides",
        "predictions.riskRulesCardsRules": "Exact = 3×.",
        "predictions.riskRulesYellowExample": "Example yellows.",
        "predictions.riskRulesOffsidesExample": "Example offsides.",
      };
      return map[key] ?? key;
    },
  }),
}));

import RiskRulesDialog from "./RiskRulesDialog";

describe("RiskRulesDialog", () => {
  it("is closed initially and opens on click, showing a section per category", () => {
    render(<RiskRulesDialog />);

    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /How does it work\?/ }));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Corner kicks")).toBeDefined();
    expect(screen.getByText("Yellow cards")).toBeDefined();
    expect(screen.getByText("Offsides")).toBeDefined();
  });

  it("closes when pressing Escape", () => {
    render(<RiskRulesDialog />);
    fireEvent.click(screen.getByRole("button", { name: /How does it work\?/ }));
    expect(screen.getByRole("dialog")).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when clicking the close button", () => {
    render(<RiskRulesDialog />);
    fireEvent.click(screen.getByRole("button", { name: /How does it work\?/ }));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
