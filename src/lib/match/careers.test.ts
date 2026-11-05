import { describe, expect, it } from "vitest";
import {
  aggregateCareers,
  battingAverage,
  battingStrikeRate,
  bestBowlingLine,
  bowlingAverage,
  bowlingEconomy,
} from "./careers";
import type { StoredMatch } from "./store";
import type { BallEvent, MatchEvent } from "../scoring/types";

function ball(p: Partial<BallEvent> = {}): BallEvent {
  return { type: "ball", batRuns: 0, extraRuns: 0, ...p };
}

function match(
  id: string,
  startedAt: string,
  events: MatchEvent[],
  overs: number | null = 20,
): StoredMatch {
  return {
    id,
    code: id.toUpperCase(),
    venue: "Wagholi",
    startedAt,
    language: "hi-IN",
    setup: {
      battingTeam: "Shivaji XI",
      bowlingTeam: "Deccan Club",
      batting: [
        { id: "b1", name: "Rutvik" },
        { id: "b2", name: "Omkar" },
        { id: "b3", name: "Prathamesh" },
      ],
      bowling: [{ id: "o1", name: "Dhananjay" }],
      strikerId: "b1",
      nonStrikerId: "b2",
      bowlerId: "o1",
      maxOvers: overs,
    },
    events,
  };
}

const six = ball({ batRuns: 6 });
const dot = ball();

describe("one match", () => {
  const careers = aggregateCareers([
    match("m1", "2026-11-01T10:00:00Z", [
      ball({ batRuns: 4 }),
      ball({ batRuns: 6 }),
      ball({ batRuns: 1 }),
      ball({ wicket: { kind: "bowled", who: "striker" } }),
      { type: "new_batter", playerId: "b3" },
      ball({ batRuns: 2 }),
    ]),
  ]);

  const rutvik = careers.find((c) => c.name === "Rutvik")!;
  const omkar = careers.find((c) => c.name === "Omkar")!;
  const bowler = careers.find((c) => c.name === "Dhananjay")!;

  it("records the batting", () => {
    expect(rutvik.batting.runs).toBe(11);
    expect(rutvik.batting.balls).toBe(3);
    expect(rutvik.batting.fours).toBe(1);
    expect(rutvik.batting.sixes).toBe(1);
    expect(rutvik.batting.innings).toBe(1);
  });

  it("counts an unbeaten innings as a not out", () => {
    // Rutvik took a single, so Omkar was on strike for the wicket.
    expect(omkar.batting.notOuts).toBe(0);
    expect(rutvik.batting.notOuts).toBe(1);
  });

  it("records the bowling", () => {
    expect(bowler.bowling.wickets).toBe(1);
    expect(bowler.bowling.balls).toBe(5);
    expect(bowler.bowling.runs).toBe(13);
    expect(bestBowlingLine(bowler.bowling)).toBe("1/13");
  });

  it("counts one appearance each", () => {
    expect(rutvik.matches).toBe(1);
    expect(bowler.matches).toBe(1);
  });

  it("leaves out a player who neither batted nor bowled", () => {
    // Prathamesh came in, so he batted; nobody else exists to leave out.
    expect(careers.map((c) => c.name).sort()).toEqual(
      ["Dhananjay", "Omkar", "Prathamesh", "Rutvik"],
    );
  });
});

describe("across matches", () => {
  const careers = aggregateCareers([
    match("m1", "2026-11-01T10:00:00Z", [
      ball({ batRuns: 4 }),
      ball({ wicket: { kind: "bowled", who: "striker" } }),
      { type: "new_batter", playerId: "b3" },
    ]),
    match("m2", "2026-11-08T10:00:00Z", [
      ball({ batRuns: 6 }),
      ball({ batRuns: 6 }),
    ]),
  ]);
  const rutvik = careers.find((c) => c.name === "Rutvik")!;

  it("adds the innings up", () => {
    expect(rutvik.matches).toBe(2);
    expect(rutvik.batting.innings).toBe(2);
    expect(rutvik.batting.runs).toBe(16);
  });

  it("averages over dismissals, not innings", () => {
    // Out once in two innings: 16 runs / 1 dismissal.
    expect(battingAverage(rutvik.batting)).toBe(16);
  });

  it("has no average before a first dismissal", () => {
    const only = aggregateCareers([match("m2", "2026-11-08T10:00:00Z", [six])]);
    expect(battingAverage(only.find((c) => c.name === "Rutvik")!.batting)).toBeNull();
  });

  it("lists the most recent match first", () => {
    expect(rutvik.appearances.map((a) => a.matchId)).toEqual(["m2", "m1"]);
  });
});

describe("bests", () => {
  it("prefers the unbeaten innings when the scores are level", () => {
    const careers = aggregateCareers([
      match("m1", "2026-11-01T10:00:00Z", [
        ball({ batRuns: 6 }),
        ball({ wicket: { kind: "bowled", who: "striker" } }),
        { type: "new_batter", playerId: "b3" },
      ]),
      match("m2", "2026-11-08T10:00:00Z", [six]),
    ]);
    const rutvik = careers.find((c) => c.name === "Rutvik")!;
    expect(rutvik.batting.best).toBe(6);
    expect(rutvik.batting.bestNotOut).toBe(true);
  });

  it("prefers fewer runs when the wickets are level", () => {
    const careers = aggregateCareers([
      match("m1", "2026-11-01T10:00:00Z", [
        ball({ batRuns: 4 }),
        ball({ batRuns: 4 }),
        ball({ wicket: { kind: "bowled", who: "striker" } }),
        { type: "new_batter", playerId: "b3" },
      ]),
      match("m2", "2026-11-08T10:00:00Z", [
        ball({ wicket: { kind: "bowled", who: "striker" } }),
        { type: "new_batter", playerId: "b3" },
      ]),
    ]);
    const bowler = careers.find((c) => c.name === "Dhananjay")!;
    // 1/0 beats 1/8.
    expect(bestBowlingLine(bowler.bowling)).toBe("1/0");
  });

  it("counts a fifty but not also a hundred", () => {
    // Three overs of sixes. The ends change after each over, so Rutvik faces
    // overs one and three (72) and Omkar faces over two (36).
    const events: MatchEvent[] = [];
    for (let i = 0; i < 18; i++) {
      events.push(six);
      if ((i + 1) % 6 === 0) events.push({ type: "new_bowler", playerId: "o1" });
    }
    const careers = aggregateCareers([match("m1", "2026-11-01T10:00:00Z", events)]);
    const rutvik = careers.find((c) => c.name === "Rutvik")!;
    const omkar = careers.find((c) => c.name === "Omkar")!;

    expect(rutvik.batting.runs).toBe(72);
    expect(rutvik.batting.fifties).toBe(1);
    expect(rutvik.batting.hundreds).toBe(0);

    expect(omkar.batting.runs).toBe(36);
    expect(omkar.batting.fifties).toBe(0);
  });
});

describe("rates", () => {
  it("computes strike rate, average and economy", () => {
    const careers = aggregateCareers([
      match("m1", "2026-11-01T10:00:00Z", [
        ball({ batRuns: 6 }),
        dot,
        ball({ wicket: { kind: "bowled", who: "striker" } }),
        { type: "new_batter", playerId: "b3" },
      ]),
    ]);
    const rutvik = careers.find((c) => c.name === "Rutvik")!;
    const bowler = careers.find((c) => c.name === "Dhananjay")!;
    expect(battingStrikeRate(rutvik.batting)).toBe(200);
    expect(bowlingAverage(bowler.bowling)).toBe(6);
    expect(bowlingEconomy(bowler.bowling)).toBe(12);
  });

  it("has no bowling average before a first wicket", () => {
    const careers = aggregateCareers([match("m1", "2026-11-01T10:00:00Z", [dot])]);
    expect(bowlingAverage(careers.find((c) => c.name === "Dhananjay")!.bowling)).toBeNull();
  });
});

describe("a match the engine rejects", () => {
  it("is skipped rather than poisoning every total", () => {
    const broken = match("bad", "2026-11-01T10:00:00Z", [
      // A new batter with nobody out is illegal, so the fold throws.
      { type: "new_batter", playerId: "b3" },
    ]);
    const good = match("m1", "2026-11-02T10:00:00Z", [ball({ batRuns: 4 })]);
    const careers = aggregateCareers([broken, good]);
    expect(careers.find((c) => c.name === "Rutvik")!.batting.runs).toBe(4);
    expect(careers.find((c) => c.name === "Rutvik")!.matches).toBe(1);
  });
});

describe("a career across a whole match", () => {
  it("counts one match, and both innings, for a player in each", () => {
    const base = match("m", "2026-11-01", []);
    const bowling = [{ id: "o1", name: "Dhananjay" }, { id: "o2", name: "Sarfaraz" }];
    const m: StoredMatch = {
      ...base,
      rules: { format: "test", days: 5 },
      setup: { ...base.setup, bowling, maxOvers: null },
      events: [
        ball({ batRuns: 4 }),
        { type: "end_innings", declared: true },
        { type: "start_innings", strikerId: "o1", nonStrikerId: "o2", bowlerId: "b1" },
        ball({ batRuns: 6 }),
      ],
    };
    const c = aggregateCareers([m]).find((x) => x.name === "Rutvik");
    expect(c?.matches).toBe(1);
    expect(c?.batting.runs).toBe(4);
    expect(c?.bowling.runs).toBe(6);
    // Batted and bowled in the same match: one line in the record, not two.
    expect(c?.appearances).toHaveLength(1);
    expect(c?.appearances[0].batting?.runs).toBe(4);
    expect(c?.appearances[0].bowling?.runs).toBe(6);
  });
});
