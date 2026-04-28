import { describe, it, expect } from "vitest";
import { getRoundLabel, buildRounds, parseRoundKey, getActiveGroupInfo } from "./rounds";

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
    expect(rounds[1]).toMatchObject({
      type: "playoff",
      label: "Quarter-finals",
      stage: "Clausura - Quarter-finals",
    });
    expect(rounds[2]).toMatchObject({
      type: "playoff",
      label: "Semi-finals",
      stage: "Clausura - Semi-finals",
    });
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

// ---------------------------------------------------------------------------
// getActiveGroupInfo
// ---------------------------------------------------------------------------

describe("getActiveGroupInfo", () => {
  it("returns null activeGroup when only one group exists (no null-group)", () => {
    const matches = [
      { group: "Clausura", kickoffTime: "2026-01-15T00:00:00Z" },
      { group: "Clausura", kickoffTime: "2026-02-15T00:00:00Z" },
    ];
    const result = getActiveGroupInfo(matches);
    expect(result.activeGroup).toBeNull();
    expect(result.nullGroupCutoff).toBeNull();
  });

  it("returns null activeGroup when no groups exist", () => {
    const matches = [
      { group: null, kickoffTime: "2026-01-15T00:00:00Z" },
      { group: null, kickoffTime: "2026-02-15T00:00:00Z" },
    ];
    const result = getActiveGroupInfo(matches);
    expect(result.activeGroup).toBeNull();
    expect(result.nullGroupCutoff).toBeNull();
  });

  it("returns null activeGroup for empty array", () => {
    const result = getActiveGroupInfo([]);
    expect(result.activeGroup).toBeNull();
    expect(result.nullGroupCutoff).toBeNull();
  });

  it("returns the group with the most recent kickoff when multiple groups", () => {
    const matches = [
      { group: "Apertura", kickoffTime: "2025-07-15T00:00:00Z" },
      { group: "Apertura", kickoffTime: "2025-12-10T00:00:00Z" },
      { group: "Clausura", kickoffTime: "2026-01-15T00:00:00Z" },
      { group: "Clausura", kickoffTime: "2026-05-20T00:00:00Z" },
    ];
    const result = getActiveGroupInfo(matches);
    expect(result.activeGroup).toBe("Clausura");
    expect(result.nullGroupCutoff).toBeNull();
  });

  it("sets cutoff to active group's MD1 when null-group matches exist (single group)", () => {
    const matches = [
      // Stale null-group matches from old sub-tournament
      { group: null, kickoffTime: "2025-11-20T00:00:00Z" },
      { group: null, kickoffTime: "2025-12-15T00:00:00Z" },
      // Current null-group playoff (after MD1)
      { group: null, kickoffTime: "2026-05-01T00:00:00Z" },
      // Current sub-tournament regular season
      { group: "Clausura", kickoffTime: "2026-01-10T00:00:00Z" },
      { group: "Clausura", kickoffTime: "2026-04-27T00:00:00Z" },
    ];
    const result = getActiveGroupInfo(matches);
    expect(result.activeGroup).toBe("Clausura");
    // Cutoff = Clausura's earliest date (MD1)
    expect(result.nullGroupCutoff).toEqual(new Date("2026-01-10T00:00:00Z"));
  });

  it("cutoff filters stale null-group but keeps current ones", () => {
    const matches = [
      { group: null, kickoffTime: "2025-12-15T00:00:00Z" }, // stale (before MD1)
      { group: null, kickoffTime: "2026-05-01T00:00:00Z" }, // current (after MD1)
      { group: "Clausura", kickoffTime: "2026-01-10T00:00:00Z" },
      { group: "Clausura", kickoffTime: "2026-04-27T00:00:00Z" },
    ];
    const result = getActiveGroupInfo(matches);
    const cutoff = result.nullGroupCutoff!;
    // Stale match is before cutoff
    expect(new Date("2025-12-15T00:00:00Z") >= cutoff).toBe(false);
    // Current match is after cutoff
    expect(new Date("2026-05-01T00:00:00Z") >= cutoff).toBe(true);
  });

  it("sets cutoff when multiple groups + null-group matches", () => {
    const matches = [
      { group: null, kickoffTime: "2025-06-01T00:00:00Z" },
      { group: null, kickoffTime: "2026-05-10T00:00:00Z" },
      { group: "Apertura", kickoffTime: "2025-07-15T00:00:00Z" },
      { group: "Apertura", kickoffTime: "2025-12-10T00:00:00Z" },
      { group: "Clausura", kickoffTime: "2026-01-15T00:00:00Z" },
      { group: "Clausura", kickoffTime: "2026-05-20T00:00:00Z" },
    ];
    const result = getActiveGroupInfo(matches);
    expect(result.activeGroup).toBe("Clausura");
    expect(result.nullGroupCutoff).toEqual(new Date("2026-01-15T00:00:00Z"));
  });

  it("includes null-group for tournaments without sub-tournament prefixes", () => {
    // World Cup style: "Group A", "Round of 16" etc. — all null group
    const matches = [
      { group: null, kickoffTime: "2026-06-01T00:00:00Z" },
      { group: null, kickoffTime: "2026-07-15T00:00:00Z" },
    ];
    const result = getActiveGroupInfo(matches);
    expect(result.activeGroup).toBeNull();
    expect(result.nullGroupCutoff).toBeNull();
  });

  it("includes null-group for Champions League style (League Stage + knockout)", () => {
    const matches = [
      { group: "League Stage", kickoffTime: "2025-09-15T00:00:00Z" },
      { group: "League Stage", kickoffTime: "2026-01-20T00:00:00Z" },
      // Knockout rounds without prefix — dates after League Stage start
      { group: null, kickoffTime: "2026-02-15T00:00:00Z" },
      { group: null, kickoffTime: "2026-03-10T00:00:00Z" },
    ];
    const result = getActiveGroupInfo(matches);
    // Single group + null-group → activeGroup set, cutoff at League Stage MD1
    expect(result.activeGroup).toBe("League Stage");
    expect(result.nullGroupCutoff).toEqual(new Date("2025-09-15T00:00:00Z"));
    // Both null-group matches are after cutoff → included
    expect(new Date("2026-02-15T00:00:00Z") >= result.nullGroupCutoff!).toBe(true);
  });
});
