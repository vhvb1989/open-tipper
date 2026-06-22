import type { ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("./LiveProvider", () => ({
  useLive: () => ({ scoresVersion: 0 }),
  useLiveMatch: () => null,
}));

vi.mock("./LiveBadge", () => ({
  LiveBadge: () => <div>LIVE</div>,
}));

vi.mock("./BadgePopover", () => ({
  default: ({ badge }: { badge: ReactNode }) => <>{badge}</>,
}));

vi.mock("@/i18n/TranslationProvider", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === "results.points") {
        const n = Number(params?.n ?? 0);
        return `${n} pt${n === 1 ? "" : "s"}`;
      }

      const map: Record<string, string> = {
        "results.vs": "vs",
        "results.noResults": "No results yet",
        "results.noResultsDesc": "Results will appear here once matches have been played.",
        "results.retry": "Retry",
        "results.tipCount": "1 tip",
        "results.noPredictions": "No predictions for this match",
        "results.unknown": "Unknown",
        "results.noPoints": "–",
        "results.exactScoreBang": "Exact score!",
        "results.bonusTooltip": "Bonus",
        "results.defaultScoreSeparator": "default score",
        "results.showRisk": "Show Risk",
        "results.hideRisk": "Hide Risk",
        "results.riskCategory": "Category",
        "results.riskPredicted": "Predicted",
        "results.riskActual": "Actual",
        "results.riskPointsRisked": "Points Risked",
        "results.riskResult": "Result",
        "results.riskPending": "Pending",
        "results.riskCancelled": "Cancelled",
        "results.riskYellowCards": "Yellow cards",
        "results.riskRedCards": "Red cards",
        "results.riskCornerKicks": "Corner kicks",
        "results.riskOffsides": "Offsides",
        "results.riskCategories.YELLOW_CARDS": "Yellow Cards",
        "results.riskCategories.RED_CARDS": "Red Cards",
        "results.riskCategories.CORNER_KICKS": "Corner Kicks",
        "results.riskCategories.OFFSIDES": "Offsides",
        "results.riskRedYes": "Yes",
        "results.riskRedNo": "No",
      };

      return map[key] ?? key;
    },
  }),
}));

import ResultsTab from "./ResultsTab";

describe("ResultsTab", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders risk stats and expandable risk details when enabled", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          riskEnabled: true,
          results: [
            {
              id: "match-1",
              matchDay: 1,
              stage: "GROUP_STAGE",
              status: "FINISHED",
              kickoffTime: "2025-06-01T18:00:00Z",
              homeGoals: 2,
              awayGoals: 1,
              homeTeam: { id: "t1", name: "Team A", shortName: "TA", tla: "TA", crest: null },
              awayTeam: { id: "t2", name: "Team B", shortName: "TB", tla: "TB", crest: null },
              matchStats: { yellowCards: 5, redCards: 1, cornerKicks: 10, offsides: 3 },
              predictions: [
                {
                  userId: "user-1",
                  userName: "Alice",
                  userImage: null,
                  homeGoals: 2,
                  awayGoals: 1,
                  pointsAwarded: 12,
                  bonusPoints: 0,
                  isBackfilled: false,
                  breakdown: null,
                  totalPointsRisked: 5,
                  riskNetPoints: 6,
                  riskPredictions: [
                    {
                      category: "YELLOW_CARDS",
                      predictedValue: 5,
                      pointsRisked: 3,
                      status: "WON",
                      pointsAwarded: 6,
                    },
                    {
                      category: "OFFSIDES",
                      predictedValue: 4,
                      pointsRisked: 2,
                      status: "PENDING",
                      pointsAwarded: null,
                    },
                    {
                      category: "RED_CARDS",
                      predictedValue: 1,
                      pointsRisked: 2,
                      status: "WON",
                      pointsAwarded: 6,
                    },
                  ],
                },
              ],
            },
          ],
          rounds: [],
          uniqueBonus: { enabled: false, multiplier: 2 },
        }),
    }) as unknown as typeof fetch;

    render(<ResultsTab groupId="group-1" />);

    await waitFor(() => {
      expect(screen.getByText("TA")).toBeDefined();
    });

    expect(screen.getByTitle("Yellow cards").textContent).toContain("5");
    expect(screen.getByTitle("Red cards").textContent).toContain("1");

    fireEvent.click(screen.getByText("TA").closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("+6Risk")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Show Risk (5 pts)"));

    await waitFor(() => {
      expect(screen.getByText("Category")).toBeDefined();
    });

    expect(screen.getByText("Yellow Cards")).toBeDefined();
    expect(screen.getByText("Offsides")).toBeDefined();
    expect(screen.getByText("Red Cards")).toBeDefined();
    expect(screen.getByText("Pending")).toBeDefined();
    // Red-card prediction (1) and actual (1) render as "Yes" rather than a number
    expect(screen.getAllByText("Yes").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("✓").length).toBeGreaterThanOrEqual(1);
  });
});
