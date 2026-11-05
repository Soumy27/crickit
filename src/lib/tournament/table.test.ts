import { describe, expect, it } from "vitest";
import type { MatchResult } from "../scoring/match";
import type { PublicSummary } from "../public/summary";
import { formatNrr, pointsTable, roundRobin } from "./table";

function finished(
  a: [string, number, number, number],
  b: [string, number, number, number],
  result: MatchResult,
  maxOvers = 20,
): PublicSummary {
  const innings = (x: typeof a, y: typeof a) => ({
    team: x[0], opponent: y[0], runs: x[1], wickets: x[2], balls: x[3], maxOvers, maxWickets: 10,
  });
  return { phase: "finished", result, innings: [innings(a, b), innings(b, a)] };
}

describe("round robin", () => {
  it.each([2, 3, 4, 5, 8])("plays every pair exactly once with %i teams", (n) => {
    const teams = Array.from({ length: n }, (_, i) => `T${i}`);
    const games = roundRobin(teams).flat();
    expect(games).toHaveLength((n * (n - 1)) / 2);
    const pairs = new Set(games.map((g) => [g.home, g.away].sort().join("-")));
    expect(pairs.size).toBe(games.length);
  });

  it("never gives a team two games in one round", () => {
    for (const round of roundRobin(["A", "B", "C", "D", "E", "F"])) {
      const seen = round.flatMap((g) => [g.home, g.away]);
      expect(new Set(seen).size).toBe(seen.length);
    }
  });
});

describe("the points table", () => {
  const win = (winner: string, kind: "runs" | "wickets", margin: number): MatchResult => ({ kind, winner, margin });

  it("gives two for a win and ranks on points", () => {
    const [top, bottom] = pointsTable(["A", "B"], [
      finished(["A", 160, 5, 120], ["B", 140, 8, 120], win("A", "runs", 20)),
    ]);
    expect(top).toMatchObject({ team: "A", won: 1, points: 2, played: 1 });
    expect(bottom).toMatchObject({ team: "B", lost: 1, points: 0, played: 1 });
  });

  it("works out net run rate from runs and overs", () => {
    const [a, b] = pointsTable(["A", "B"], [
      finished(["A", 160, 5, 120], ["B", 140, 8, 120], win("A", "runs", 20)),
    ]);
    expect(a.nrr).toBeCloseTo(1, 5);
    expect(b.nrr).toBeCloseTo(-1, 5);
    expect(formatNrr(a.nrr)).toBe("+1.000");
    expect(formatNrr(b.nrr)).toBe("-1.000");
  });

  it("counts a bowled-out side's full quota of overs", () => {
    const [a, b] = pointsTable(["A", "B"], [
      // B all out in 15 overs: 80 off 20 for the rate, not 80 off 15.
      finished(["A", 160, 5, 120], ["B", 80, 10, 90], win("A", "runs", 80)),
    ]);
    expect(b.ballsFor).toBe(120);
    expect(a.nrr).toBeCloseTo(160 / 20 - 80 / 20, 5);
  });

  it("does not stretch a side that chased with balls to spare", () => {
    const [a] = pointsTable(["A", "B"], [
      finished(["B", 100, 10, 120], ["A", 101, 2, 60], win("A", "wickets", 8)),
    ]);
    expect(a.ballsFor).toBe(60);
    expect(a.nrr).toBeCloseTo(101 / 10 - 100 / 20, 5);
  });

  it("gives one each for a tie, and counts it in the rate", () => {
    const rows = pointsTable(["A", "B"], [
      finished(["A", 120, 5, 120], ["B", 120, 5, 120], { kind: "tie", winner: null, margin: 0 }),
    ]);
    expect(rows.map((r) => r.points)).toEqual([1, 1]);
    expect(rows[0].ballsFor).toBe(120);
  });

  it("gives one each for no result and leaves the rate alone", () => {
    const rows = pointsTable(["A", "B"], [
      finished(["A", 40, 1, 30], ["B", 0, 0, 0], { kind: "abandoned", winner: null, margin: 0 }),
    ]);
    expect(rows.map((r) => r.points)).toEqual([1, 1]);
    expect(rows.map((r) => r.noResult)).toEqual([1, 1]);
    expect(rows.map((r) => r.nrr)).toEqual([null, null]);
  });

  it("credits Team 1 with par, off the overs faced, when rain ends the chase", () => {
    const match = finished(["A", 160, 5, 120], ["B", 90, 2, 60], win("B", "runs", 10));
    const [b, a] = pointsTable(["A", "B"], [{ ...match, rainPar: 80 }]);
    expect(a).toMatchObject({ team: "A", runsFor: 80, ballsFor: 60, runsAgainst: 90, ballsAgainst: 60 });
    expect(b).toMatchObject({ team: "B", runsFor: 90, ballsFor: 60, runsAgainst: 80, ballsAgainst: 60 });
    expect(b.nrr).toBeCloseTo(90 / 10 - 80 / 10, 5);
    expect(a.nrr).toBeCloseTo(-1, 5);
  });

  it("ignores a match still being played", () => {
    const rows = pointsTable(["A", "B"], [
      { phase: "playing", result: null, innings: [{ team: "A", opponent: "B", runs: 50, wickets: 1, balls: 30, maxOvers: 20, maxWickets: 10 }] },
    ]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });

  it("ignores a side that is not in the tournament", () => {
    const rows = pointsTable(["A", "B"], [
      finished(["A", 160, 5, 120], ["Z", 140, 8, 120], win("A", "runs", 20)),
    ]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });

  it("breaks level points on net run rate", () => {
    const rows = pointsTable(["A", "B", "C", "D"], [
      finished(["A", 160, 5, 120], ["B", 150, 5, 120], win("A", "runs", 10)),
      finished(["C", 200, 5, 120], ["D", 100, 5, 120], win("C", "runs", 100)),
    ]);
    expect(rows.slice(0, 2).map((r) => r.team)).toEqual(["C", "A"]);
  });
});
