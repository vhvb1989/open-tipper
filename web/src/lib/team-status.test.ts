import { describe, it, expect } from "vitest";
import { computeEliminatedTeamIds, type TeamStatusMatch } from "./team-status";

function match(overrides: Partial<TeamStatusMatch>): TeamStatusMatch {
  return {
    stage: "Quarter-finals",
    status: "FINISHED",
    kickoffTime: new Date("2025-01-01T00:00:00Z"),
    homeTeamId: "home",
    awayTeamId: "away",
    homeGoals: 0,
    awayGoals: 0,
    ...overrides,
  };
}

describe("computeEliminatedTeamIds", () => {
  it("returns empty set when there are no matches", () => {
    expect(computeEliminatedTeamIds([]).size).toBe(0);
  });

  it("keeps a team alive when it has an upcoming match", () => {
    const matches: TeamStatusMatch[] = [
      // A lost its last finished knockout match...
      match({ homeTeamId: "A", awayTeamId: "B", homeGoals: 0, awayGoals: 1, status: "FINISHED" }),
      // ...but still has an upcoming (second leg) match → alive.
      match({
        homeTeamId: "B",
        awayTeamId: "A",
        homeGoals: null,
        awayGoals: null,
        status: "SCHEDULED",
        kickoffTime: new Date("2025-01-08T00:00:00Z"),
      }),
    ];
    const eliminated = computeEliminatedTeamIds(matches);
    expect(eliminated.has("A")).toBe(false);
    expect(eliminated.has("B")).toBe(false);
  });

  it("eliminates a team that lost its last knockout match with no upcoming games", () => {
    const matches: TeamStatusMatch[] = [
      match({
        stage: "Semi-finals",
        homeTeamId: "loser",
        awayTeamId: "winner",
        homeGoals: 1,
        awayGoals: 2,
        status: "FINISHED",
      }),
    ];
    const eliminated = computeEliminatedTeamIds(matches);
    expect(eliminated.has("loser")).toBe(true);
    expect(eliminated.has("winner")).toBe(false);
  });

  it("keeps the champion colored after winning the final", () => {
    const matches: TeamStatusMatch[] = [
      match({
        stage: "Final",
        homeTeamId: "champion",
        awayTeamId: "runnerUp",
        homeGoals: 3,
        awayGoals: 1,
        status: "FINISHED",
        kickoffTime: new Date("2025-02-01T00:00:00Z"),
      }),
    ];
    const eliminated = computeEliminatedTeamIds(matches);
    expect(eliminated.has("champion")).toBe(false);
    expect(eliminated.has("runnerUp")).toBe(true);
  });

  it("does not eliminate teams based on group-stage results", () => {
    const matches: TeamStatusMatch[] = [
      match({
        stage: "Regular Season - 5",
        homeTeamId: "G1",
        awayTeamId: "G2",
        homeGoals: 0,
        awayGoals: 2,
        status: "FINISHED",
      }),
    ];
    const eliminated = computeEliminatedTeamIds(matches);
    expect(eliminated.has("G1")).toBe(false);
    expect(eliminated.has("G2")).toBe(false);
  });

  it("treats a tied knockout match (penalties) as not lost", () => {
    const matches: TeamStatusMatch[] = [
      match({
        stage: "Quarter-finals",
        homeTeamId: "P1",
        awayTeamId: "P2",
        homeGoals: 1,
        awayGoals: 1,
        status: "FINISHED",
      }),
    ];
    const eliminated = computeEliminatedTeamIds(matches);
    expect(eliminated.has("P1")).toBe(false);
    expect(eliminated.has("P2")).toBe(false);
  });

  it("uses the most recent finished knockout match to decide elimination", () => {
    const matches: TeamStatusMatch[] = [
      // Earlier round: T won.
      match({
        stage: "Round of 16",
        homeTeamId: "T",
        awayTeamId: "X",
        homeGoals: 2,
        awayGoals: 0,
        status: "FINISHED",
        kickoffTime: new Date("2025-01-01T00:00:00Z"),
      }),
      // Later round: T lost and has no further matches → eliminated.
      match({
        stage: "Quarter-finals",
        homeTeamId: "Y",
        awayTeamId: "T",
        homeGoals: 3,
        awayGoals: 1,
        status: "FINISHED",
        kickoffTime: new Date("2025-01-08T00:00:00Z"),
      }),
    ];
    const eliminated = computeEliminatedTeamIds(matches);
    expect(eliminated.has("T")).toBe(true);
  });
});
