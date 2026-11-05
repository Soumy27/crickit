/**
 * These are the ICC's own worked examples, with the ICC's answers. If this file
 * passes, the arithmetic matches the published method.
 */
import { describe, expect, it } from "vitest";
import {
  G50_INTERNATIONAL as G50,
  inningsResources,
  minimumOvers,
  parScore,
  resourcesLeft,
  reviseTarget,
} from "./dls";
import { RESOURCES } from "./dls-table";

const pct = (tenths: number) => tenths / 10;

describe("the published table", () => {
  it("covers every ball of a 50-over innings", () => {
    expect(RESOURCES).toHaveLength(301);
    for (const row of RESOURCES) expect(row).toHaveLength(10);
  });

  it.each([
    [300, 0, 100.0], [180, 3, 61.6], [120, 3, 49.1], [228, 1, 82.0], [168, 1, 68.8],
    [270, 0, 95.0], [210, 0, 82.7], [198, 0, 79.8], [108, 3, 45.9], [96, 3, 42.3],
    [17, 8, 6.9], [46, 6, 19.4], [48, 2, 25.5], [18, 2, 10.4], [0, 0, 0],
  ])("%i balls left, %i down is %f%%", (balls, wickets, want) => {
    expect(pct(resourcesLeft(balls, wickets))).toBe(want);
  });

  it("only ever falls as balls and wickets go", () => {
    for (let b = 1; b < RESOURCES.length; b++) {
      for (let w = 0; w < 10; w++) expect(RESOURCES[b][w]).toBeGreaterThanOrEqual(RESOURCES[b - 1][w]);
    }
  });

  it("has nothing left when all ten are down", () => {
    expect(resourcesLeft(120, 10)).toBe(0);
  });
});

describe("the ICC's worked examples", () => {
  it("1: a suspension during Team 1's innings raises the target to 185", () => {
    const r1 = inningsResources(50, [{ ballsBefore: 180, ballsAfter: 120, wickets: 3 }]);
    const r2 = inningsResources(40, []);
    expect([pct(r1), pct(r2)]).toEqual([87.5, 89.3]);
    expect(reviseTarget(180, r1, r2, G50)).toBe(185);
  });

  it("2: a delay to Team 2's innings sets a target of 185", () => {
    expect(reviseTarget(212, inningsResources(45, []), inningsResources(35, []), G50)).toBe(185);
  });

  const first = { ballsBefore: 228, ballsAfter: 168, wickets: 1 };
  const second = { ballsBefore: 108, ballsAfter: 96, wickets: 3 };

  it("3: a suspension during Team 2's innings sets a target of 218", () => {
    const r2 = inningsResources(50, [first]);
    expect(pct(r2)).toBe(86.8);
    expect(reviseTarget(250, 1000, r2, G50)).toBe(218);
  });

  it("4: a second suspension sets 209, and abandonment leaves a par of 159", () => {
    expect(reviseTarget(250, 1000, inningsResources(50, [first, second]), G50)).toBe(209);
    const r2 = inningsResources(50, [first, second, { ballsBefore: 46, ballsAfter: 0, wickets: 6 }]);
    expect(pct(r2)).toBe(63.8);
    expect(parScore(250, 1000, r2, G50)).toBe(159);
  });

  const india = inningsResources(50, [{ ballsBefore: 17, ballsAfter: 0, wickets: 8 }]);

  it("5: India v Pakistan 1996, an innings cut short, sets a target of 194", () => {
    expect(pct(india)).toBe(93.1);
    expect(reviseTarget(226, india, inningsResources(33, []), G50)).toBe(194);
  });

  it("6: the same match with a further stoppage sets a target of 158", () => {
    const r2 = inningsResources(33, [{ ballsBefore: 48, ballsAfter: 18, wickets: 2 }]);
    expect(pct(r2)).toBe(64.7);
    expect(reviseTarget(226, india, r2, G50)).toBe(158);
  });
});

describe("the landing page's rain demo", () => {
  it.each([[20, 169], [10, 96], [5, 52]])("168 in 20, cut to %i overs, needs %i", (overs, want) => {
    expect(reviseTarget(168, inningsResources(20, []), inningsResources(overs, []))).toBe(want);
  });
});

describe("an unchanged match", () => {
  it.each([50, 20, 10])("a %i-over chase needs one more than the score", (overs) => {
    const r = inningsResources(overs, []);
    expect(reviseTarget(137, r, r)).toBe(138);
  });
});

describe("the minimum for a result", () => {
  it.each([[50, 20], [40, 16], [20, 5], [10, 5], [6, 3]])("%i overs needs %i", (overs, want) => {
    expect(minimumOvers(overs)).toBe(want);
  });
});
