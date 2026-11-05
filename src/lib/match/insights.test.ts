import { describe, expect, it } from "vitest";
import type { Career, CareerAppearance } from "./careers";
import { careerInsights } from "./insights";

function career(scores: [number, boolean][], over: Partial<Career["batting"]> = {}, bowled: [number, number][] = []): Career {
  // Newest first, as careers sorts them.
  const appearances: CareerAppearance[] = scores.map(([runs, out], i) => ({
    matchId: `m${i}`, date: `2026-10-${String(28 - i).padStart(2, "0")}`, venue: "Wagholi", opponent: "Deccan Club",
    batting: { runs, balls: runs + 5, out },
    ...(bowled[i] ? { bowling: { balls: 24, runs: bowled[i][1], wickets: bowled[i][0] } } : {}),
  }));
  const dismissals = scores.filter(([, out]) => out).length;
  return {
    key: "rutvik", name: "Rutvik", matches: scores.length,
    batting: {
      innings: scores.length, runs: scores.reduce((n, [r]) => n + r, 0),
      balls: scores.reduce((n, [r]) => n + r + 5, 0), fours: 10, sixes: 5,
      notOuts: scores.length - dismissals, best: Math.max(0, ...scores.map(([r]) => r)),
      bestNotOut: false, fifties: 0, hundreds: 0, ...over,
    },
    bowling: {
      innings: bowled.length, balls: bowled.length * 24, runs: bowled.reduce((n, [, r]) => n + r, 0),
      wickets: bowled.reduce((n, [w]) => n + w, 0), maidens: 0, bestWickets: -1, bestRuns: 0,
    },
    appearances,
  };
}

describe("a player's insights", () => {
  it("stays quiet on too few matches, and says so", () => {
    const out = careerInsights(career([[80, false], [60, true]]));
    expect(out.thin).toBe(true);
    expect(out.notes).toEqual([]);
  });

  it("reads the form guide oldest to newest and stars the not-outs", () => {
    const out = careerInsights(career([[41, false], [68, false], [9, true]]));
    expect(out.battingForm).toEqual(["9", "68*", "41*"]);
  });

  it("only shows the last five", () => {
    const out = careerInsights(career([[1, true], [2, true], [3, true], [4, true], [5, true], [6, true]]));
    expect(out.battingForm).toEqual(["5", "4", "3", "2", "1"]);
  });

  it("calls a real rise in form", () => {
    const out = careerInsights(career([[60, true], [50, true], [70, true], [10, true], [20, true], [15, true]]));
    expect(out.notes[0]).toMatch(/^In form: 60 runs .* up from 15/);
  });

  it("calls a real dip", () => {
    const out = careerInsights(career([[10, true], [20, true], [15, true], [60, true], [50, true], [70, true]]));
    expect(out.notes[0]).toMatch(/^A quiet patch/);
  });

  it("says nothing about form on a level run", () => {
    const out = careerInsights(career([[30, true], [30, true], [30, true], [30, true], [30, true], [30, true]]));
    expect(out.notes.some((n) => /form|patch/i.test(n))).toBe(false);
  });

  it("does not call form without six innings to compare", () => {
    const out = careerInsights(career([[90, true], [90, true], [90, true], [1, true]]));
    expect(out.notes.some((n) => /form|patch/i.test(n))).toBe(false);
  });

  it("works out boundary share and balls per dismissal", () => {
    const out = careerInsights(career([[50, true], [50, true], [50, true]], { fours: 15, sixes: 5 }));
    expect(out.notes).toContain("60% of their runs come in boundaries.");
    expect(out.notes).toContain("Faces 55 balls for each dismissal.");
  });

  it("names the commonest way out", () => {
    const out = careerInsights(career([[5, true], [5, true], [5, true]], { dismissals: { caught: 2, bowled: 1 } }));
    expect(out.notes).toContain("Most often out caught: 2 of 3 dismissals.");
  });

  it("counts how many starts became fifties", () => {
    const out = careerInsights(career([[55, true], [25, true], [30, true]]));
    expect(out.notes).toContain("Turned 1 of 3 starts of 20 or more into fifties.");
  });

  it("reads the bowling as well", () => {
    const out = careerInsights(career([[1, true]], {}, [[2, 20]]));
    expect(out.bowlingForm).toEqual(["2/20"]);
    const full = careerInsights(career([[1, true], [1, true], [1, true]], {}, [[2, 20], [1, 30], [3, 15]]));
    expect(full.notes).toContain("Takes a wicket every 12 balls.");
    expect(full.notes).toContain("Takes 2.0 wickets a match when bowling.");
  });

  it("survives a player who has never been out, and never scored", () => {
    const out = careerInsights(career([[0, false], [0, false], [0, false]]));
    expect(out.notes.every((n) => !/NaN|Infinity/.test(n))).toBe(true);
  });
});
