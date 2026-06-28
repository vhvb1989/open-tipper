import { describe, it, expect } from "vitest";
import { rankFrame, maxValue, type RaceUser, type RaceTrajectoryPoint } from "./race";

const users: RaceUser[] = [
  { id: "a", name: "Ana", image: null },
  { id: "b", name: "Beto", image: null },
  { id: "c", name: "Caro", image: null },
];

function point(cum: Record<string, number>): RaceTrajectoryPoint {
  return {
    matchDay: 1,
    stage: null,
    homeTeam: "H",
    awayTeam: "A",
    homeGoals: 1,
    awayGoals: 0,
    users: Object.fromEntries(Object.entries(cum).map(([k, v]) => [k, { cumulative: v }])),
  };
}

describe("rankFrame", () => {
  it("ranks users by cumulative descending (rank 0 = leader)", () => {
    const rows = rankFrame(point({ a: 5, b: 9, c: 7 }), users);
    expect(rows.map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(rows.map((r) => r.rank)).toEqual([0, 1, 2]);
  });

  it("defaults missing users to 0 and breaks ties by id", () => {
    const rows = rankFrame(point({ a: 4 }), users);
    expect(rows[0].userId).toBe("a");
    expect(rows.find((r) => r.userId === "b")!.value).toBe(0);
  });
});

describe("maxValue", () => {
  it("returns the largest cumulative across all frames", () => {
    const traj = [point({ a: 2, b: 1 }), point({ a: 8, b: 3 })];
    expect(maxValue(traj, users)).toBe(8);
  });

  it("is at least 1 to avoid divide-by-zero", () => {
    expect(maxValue([point({ a: 0 })], users)).toBe(1);
  });
});
