import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/i18n/TranslationProvider", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "race.title": "Standings Race",
        "race.hint": "Watch the standings evolve.",
        "race.noData": "No race data yet",
        "race.noDataDesc": "The race will appear once matches have been played.",
        "race.error": "Failed to load race data. Please try again.",
        "race.retry": "Retry",
        "race.play": "Play",
        "race.pause": "Pause",
        "race.restart": "Restart",
        "race.speed": "Speed",
        "race.unknown": "Unknown",
        "race.matchDayLabel": "Match Day {n}",
        "race.pts": "pts",
      };
      let result = map[key] ?? key;
      if (params)
        for (const [k, v] of Object.entries(params)) result = result.replace(`{${k}}`, String(v));
      return result;
    },
  }),
}));

import RaceTab from "./RaceTab";

const mockData = {
  trajectory: [
    {
      matchDay: 1,
      stage: null,
      homeTeam: "A",
      awayTeam: "B",
      homeGoals: 1,
      awayGoals: 0,
      users: { u1: { cumulative: 5 }, u2: { cumulative: 9 } },
    },
    {
      matchDay: 2,
      stage: null,
      homeTeam: "C",
      awayTeam: "D",
      homeGoals: 0,
      awayGoals: 0,
      users: { u1: { cumulative: 20 }, u2: { cumulative: 12 } },
    },
  ],
  users: [
    { id: "u1", name: "Alice", image: null },
    { id: "u2", name: "Bob", image: null },
  ],
};

describe("RaceTab", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders race with members and play control", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }) as unknown as typeof fetch;
    render(<RaceTab groupId="g1" />);
    await waitFor(() => expect(screen.getByText("Standings Race")).toBeDefined());
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
    expect(screen.getByText("Play")).toBeDefined();
  });

  it("scrubbing changes the displayed match", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }) as unknown as typeof fetch;
    render(<RaceTab groupId="g1" />);
    await waitFor(() => screen.getByText("Standings Race"));
    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.value).toBe("0");
    fireEvent.change(slider, { target: { value: "1" } });
    expect(slider.value).toBe("1");
  });

  it("shows empty state when no data", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ trajectory: [], users: [] }),
    }) as unknown as typeof fetch;
    render(<RaceTab groupId="g1" />);
    await waitFor(() => expect(screen.getByText("No race data yet")).toBeDefined());
  });

  it("uses the trajectory endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<RaceTab groupId="g1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/groups/g1/trajectory"));
  });
});
