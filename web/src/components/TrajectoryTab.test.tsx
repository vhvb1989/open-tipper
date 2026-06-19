import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock i18n
vi.mock("@/i18n/TranslationProvider", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "trajectory.title": "Points Trajectory",
        "trajectory.noData": "No trajectory data yet",
        "trajectory.noDataDesc": "Trajectory will appear once matches have been played and scored.",
        "trajectory.error": "Failed to load trajectory. Please try again.",
        "trajectory.retry": "Retry",
        "trajectory.hint": "Tap on the chart to see match details.",
      };
      let result = map[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{{${k}}}`, String(v));
        }
      }
      return result;
    },
  }),
}));

// Mock Recharts to avoid SVG rendering issues in tests
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  Brush: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Legend: () => <div />,
}));

import TrajectoryTab from "./TrajectoryTab";

const mockTrajectoryData = {
  trajectory: [
    {
      matchId: "m1",
      matchDay: 1,
      stage: null,
      kickoffTime: "2025-01-01T18:00:00Z",
      homeGoals: 2,
      awayGoals: 1,
      homeTeam: "Team A",
      awayTeam: "Team B",
      homeTeamCrest: null,
      awayTeamCrest: null,
      users: {
        user1: { cumulative: 15, matchPoints: 15, prediction: "2 - 1" },
        user2: { cumulative: 5, matchPoints: 5, prediction: "1 - 0" },
      },
    },
    {
      matchId: "m2",
      matchDay: 1,
      stage: null,
      kickoffTime: "2025-01-01T20:00:00Z",
      homeGoals: 0,
      awayGoals: 0,
      homeTeam: "Team C",
      awayTeam: "Team D",
      homeTeamCrest: null,
      awayTeamCrest: null,
      users: {
        user1: { cumulative: 25, matchPoints: 10, prediction: "1 - 1" },
        user2: { cumulative: 20, matchPoints: 15, prediction: "0 - 0" },
      },
    },
  ],
  users: [
    { id: "user1", name: "Alice", image: null },
    { id: "user2", name: "Bob", image: null },
  ],
  currentUserId: "user1",
};

describe("TrajectoryTab", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading spinner initially", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<TrajectoryTab groupId="g1" />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders chart when data is loaded", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrajectoryData),
    }) as unknown as typeof fetch;

    render(<TrajectoryTab groupId="g1" />);

    await waitFor(() => {
      expect(screen.getByText("Points Trajectory")).toBeDefined();
    });

    expect(screen.getByTestId("line-chart")).toBeDefined();
  });

  it("shows empty state when no trajectory data", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ trajectory: [], users: [], currentUserId: "user1" }),
    }) as unknown as typeof fetch;

    render(<TrajectoryTab groupId="g1" />);

    await waitFor(() => {
      expect(screen.getByText("No trajectory data yet")).toBeDefined();
    });
  });

  it("shows error state on fetch failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    render(<TrajectoryTab groupId="g1" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load trajectory. Please try again.")).toBeDefined();
    });

    expect(screen.getByText("Retry")).toBeDefined();
  });

  it("fetches from correct API endpoint", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrajectoryData),
    }) as unknown as typeof fetch;

    render(<TrajectoryTab groupId="my-group-123" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/groups/my-group-123/trajectory");
    });
  });
});
