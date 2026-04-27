import { describe, it, expect } from "vitest";
import { getRoundLabel, buildRounds, parseRoundKey } from "./rounds";

// ---------------------------------------------------------------------------
// getRoundLabel
// ---------------------------------------------------------------------------

describe("getRoundLabel", () => {
  it("strips sub-tournament prefix", () => {
    expect(getRoundLabel("Clausura - Quarter-finals")).toBe("Quarter-finals");
  });

  it("strips regular season prefix", () => {
    expect(getRoundLabel("Regular Season - 14")).toBe("14");
  });

  it("returns the stage as-is when no prefix", () => {
    expect(getRoundLabel("Quarter-finals")).toBe("Quarter-finals");
  });

  it("returns the stage as-is for simple strings", () => {
    expect(getRoundLabel("Final")).toBe("Final");
  });

  it("handles League Stage prefix", () => {
    expect(getRoundLabel("League Stage - 8")).toBe("8");
  });
});

// ---------------------------------------------------------------------------
// buildRounds
// ---------------------------------------------------------------------------

describe("buildRounds", () => {
  it("builds matchDay rounds sorted ascending", () => {
    const matches = [
      { matchDay: 3, stage: "Clausura - 3", kickoffTime: "2026-03-01T20:00:00Z" },
      { matchDay: 1, stage: "Clausura - 1", kickoffTime: "2026-01-15T20:00:00Z" },
      { matchDay: 2, stage: "Clausura - 2", kickoffTime: "2026-02-01T20:00:00Z" },
    ];
    const rounds = buildRounds(matches);
    expect(rounds).toHaveLength(3);
    expect(rounds.map((r) => r.matchDay)).toEqual([1, 2, 3]);
    expect(rounds.every((r) => r.type === "matchDay")).toBe(true);
  });

  it("builds playoff rounds after matchDay rounds, sorted by kickoff", () => {
    const matches = [
      { matchDay: 17, stage: "Clausura - 17", kickoffTime: "2026-04-20T20:00:00Z" },
      { matchDay: null, stage: "Clausura - Quarter-finals", kickoffTime: "2026-05-01T20:00:00Z" },
      { matchDay: null, stage: "Clausura - Semi-finals", kickoffTime: "2026-05-10T20:00:00Z" },
      { matchDay: null, stage: "Clausura - Final", kickoffTime: "2026-05-20T20:00:00Z" },
    ];
    const rounds = buildRounds(matches);
    expect(rounds).toHaveLength(4);
    expect(rounds[0]).toMatchObject({ type: "matchDay", matchDay: 17 });
    expect(rounds[1]).toMatchObject({ type: "playoff", label: "Quarter-finals", stage: "Clausura - Quarter-finals" });
    expect(rounds[2]).toMatchObject({ type: "playoff", label: "Semi-finals", stage: "Clausura - Semi-finals" });
    expect(rounds[3]).toMatchObject({ type: "playoff", label: "Final", stage: "Clausura - Final" });
  });

  it("deduplicates matchDays", () => {
    const matches = [
      { matchDay: 1, stage: "Clausura - 1", kickoffTime: "2026-01-15T20:00:00Z" },
      { matchDay: 1, stage: "Clausura - 1", kickoffTime: "2026-01-15T22:00:00Z" },
    ];
    const rounds = buildRounds(matches);
    expect(rounds).toHaveLength(1);
  });

  it("deduplicates playoff stages", () => {
    const matches = [
      { matchDay: null, stage: "Clausura - Quarter-finals", kickoffTime: "2026-05-01T20:00:00Z" },
      { matchDay: null, stage: "Clausura - Quarter-finals", kickoffTime: "2026-05-02T20:00:00Z" },
    ];
    const rounds = buildRounds(matches);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].label).toBe("Quarter-finals");
  });

  it("handles World Cup format (no prefix)", () => {
    const matches = [
      { matchDay: 1, stage: "Group A - 1", kickoffTime: "2026-06-01T18:00:00Z" },
      { matchDay: null, stage: "Round of 16", kickoffTime: "2026-06-20T18:00:00Z" },
      { matchDay: null, stage: "Quarter-finals", kickoffTime: "2026-06-25T18:00:00Z" },
      { matchDay: null, stage: "Final", kickoffTime: "2026-07-10T18:00:00Z" },
    ];
    const rounds = buildRounds(matches);
    expect(rounds).toHaveLength(4);
    expect(rounds[1]).toMatchObject({ type: "playoff", label: "Round of 16" });
    expect(rounds[3]).toMatchObject({ type: "playoff", label: "Final" });
  });

  it("ignores matches with null matchDay and null stage", () => {
    const matches = [
      { matchDay: null, stage: null, kickoffTime: "2026-01-01T00:00:00Z" },
      { matchDay: 1, stage: "MD 1", kickoffTime: "2026-01-01T00:00:00Z" },
    ];
    const rounds = buildRounds(matches);
    expect(rounds).toHaveLength(1);
  });

  it("returns empty array for no matches", () => {
    expect(buildRounds([])).toEqual([]);
  });

  it("uses correct keys for matchDay and playoff rounds", () => {
    const matches = [
      { matchDay: 5, stage: "Clausura - 5", kickoffTime: "2026-03-01T20:00:00Z" },
      { matchDay: null, stage: "Clausura - Final", kickoffTime: "2026-05-20T20:00:00Z" },
    ];
    const rounds = buildRounds(matches);
    expect(rounds[0].key).toBe("md:5");
    expect(rounds[1].key).toBe("stage:Clausura - Final");
  });
});

// ---------------------------------------------------------------------------
// parseRoundKey
// ---------------------------------------------------------------------------

describe("parseRoundKey", () => {
  it("parses matchDay key", () => {
    expect(parseRoundKey("md:5")).toEqual({ matchDay: 5 });
  });

  it("parses stage key", () => {
    expect(parseRoundKey("stage:Clausura - Quarter-finals")).toEqual({
      stage: "Clausura - Quarter-finals",
    });
  });

  it("falls back to numeric for plain numbers", () => {
    expect(parseRoundKey("3")).toEqual({ matchDay: 3 });
  });

  it("falls back to stage for non-numeric strings", () => {
    expect(parseRoundKey("Quarter-finals")).toEqual({ stage: "Quarter-finals" });
  });
});
