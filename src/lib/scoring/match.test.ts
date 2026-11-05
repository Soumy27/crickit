/**
 * The rules of a whole match. Test matches follow MCC Laws 13 and 14: a side
 * may enforce the follow-on from 200 ahead in a five-day match, and 150, 100 or
 * 75 in shorter ones. The other results follow from who batted when.
 */
import { describe, expect, it } from "vitest";
import { buildMatch, followOnMargin, type MatchRules } from "./match";
import type { BallEvent, InningsSetup, MatchEvent, Player } from "./types";

const players = (prefix: string, n = 3): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix}${i}` }));

const setup = (overs: number | null = 2): InningsSetup => ({
  battingTeam: "Shivaji",
  bowlingTeam: "Deccan",
  batting: players("s"),
  bowling: players("d"),
  strikerId: "s0",
  nonStrikerId: "s1",
  bowlerId: "d0",
  maxOvers: overs,
});

const LIMITED: MatchRules = { format: "limited" };
const TEST: MatchRules = { format: "test", days: 5 };

const ball = (batRuns = 0, p: Partial<BallEvent> = {}): BallEvent => ({ type: "ball", batRuns, extraRuns: 0, ...p });
const out: BallEvent = ball(0, { wicket: { kind: "bowled", who: "striker" } });
const startDeccan: MatchEvent = { type: "start_innings", strikerId: "d0", nonStrikerId: "d1", bowlerId: "s0" };
const startShivaji: MatchEvent = { type: "start_innings", strikerId: "s0", nonStrikerId: "s1", bowlerId: "d0" };

/** Scores `runs` in sixes then a remainder, for a side with no over limit. */
function score(runs: number): MatchEvent[] {
  const events: MatchEvent[] = [];
  let left = runs;
  let legal = 0;
  let bowler = 0;
  while (left > 0) {
    const r = left >= 6 ? 6 : left % 2 === 0 ? left : left;
    events.push(ball(Math.min(r, 6)));
    left -= Math.min(r, 6);
    legal++;
    if (legal % 6 === 0 && left > 0) {
      bowler = (bowler + 1) % 3;
      events.push({ type: "new_bowler", playerId: "__bowler__" });
    }
  }
  return events;
}

/** Fills in the bowler for whichever side is in the field. */
const bowling = (events: MatchEvent[], side: string) =>
  events.map((e) => (e.type === "new_bowler" ? { ...e, playerId: `${side}1` } : e));

/** Two dismissals ends an innings for a three-player side. */
const allOut = (): MatchEvent[] => [out, { type: "new_batter", playerId: "__next__" }, out];
const allOutAs = (next: string): MatchEvent[] =>
  allOut().map((e) => (e.type === "new_batter" ? { ...e, playerId: next } : e));

describe("a limited-overs match", () => {
  it("opens in the first innings with no target", () => {
    const m = buildMatch(setup(), LIMITED, []);
    expect(m.phase).toBe("playing");
    expect(m.innings).toHaveLength(1);
    expect(m.current.target).toBeNull();
  });

  it("stops between innings once the first is over, with the other side next", () => {
    const m = buildMatch(setup(1), LIMITED, Array(6).fill(ball(1)));
    expect(m.phase).toBe("between");
    expect(m.next?.battingTeam).toBe("Deccan");
    expect(m.result).toBeNull();
  });

  it("sets a target of one more than the first innings", () => {
    const m = buildMatch(setup(1), LIMITED, [...Array(6).fill(ball(2)), startDeccan]);
    expect(m.phase).toBe("playing");
    expect(m.current.battingTeam).toBe("Deccan");
    expect(m.current.target).toBe(13);
  });

  it("gives the second side the first side's squad to bowl", () => {
    const m = buildMatch(setup(1), LIMITED, [...Array(6).fill(ball(2)), startDeccan]);
    expect(Object.keys(m.current.batters)).toEqual(["d0", "d1", "d2"]);
    expect(Object.keys(m.current.bowlers)).toEqual(["s0", "s1", "s2"]);
  });

  it("ends the moment the target is reached, won by wickets in hand", () => {
    const m = buildMatch(setup(1), LIMITED, [...Array(6).fill(ball(1)), startDeccan, ball(6), ball(1)]);
    expect(m.phase).toBe("finished");
    expect(m.result).toMatchObject({ kind: "wickets", winner: "Deccan", margin: 2 });
  });

  it("is won by runs when the chase falls short", () => {
    const m = buildMatch(setup(1), LIMITED, [...Array(6).fill(ball(2)), startDeccan, ...Array(6).fill(ball(1))]);
    expect(m.result).toMatchObject({ kind: "runs", winner: "Shivaji", margin: 6 });
  });

  it("is a tie when the scores finish level", () => {
    const m = buildMatch(setup(1), LIMITED, [...Array(6).fill(ball(1)), startDeccan, ...Array(6).fill(ball(1))]);
    expect(m.result).toMatchObject({ kind: "tie", winner: null });
  });

  it("counts extras toward the target", () => {
    const m = buildMatch(setup(1), LIMITED, [ball(1), ...Array(5).fill(ball(0)), startDeccan, ball(0, { extra: "wide" }), ball(0, { extra: "wide" })]);
    expect(m.result).toMatchObject({ kind: "wickets", winner: "Deccan" });
  });

  it("can be abandoned", () => {
    const m = buildMatch(setup(), LIMITED, [ball(1), { type: "end_match", outcome: "abandoned" }]);
    expect(m.phase).toBe("finished");
    expect(m.result?.kind).toBe("abandoned");
  });

  it("refuses a ball after the match is over", () => {
    expect(() =>
      buildMatch(setup(), LIMITED, [{ type: "end_match", outcome: "abandoned" }, ball(1)]),
    ).toThrow();
  });

  it("refuses a third innings", () => {
    const events = [...Array(6).fill(ball(1)), startDeccan, ...Array(6).fill(ball(0))];
    expect(() => buildMatch(setup(1), LIMITED, [...events, startShivaji])).toThrow();
  });

  it("still reads a log saved before innings existed", () => {
    const m = buildMatch(setup(), undefined, [ball(4)]);
    expect(m.rules.format).toBe("limited");
    expect(m.current.runs).toBe(4);
  });

  it("undoes across the innings break by refolding one fewer event", () => {
    const events = [...Array(6).fill(ball(1)), startDeccan];
    expect(buildMatch(setup(1), LIMITED, events).phase).toBe("playing");
    expect(buildMatch(setup(1), LIMITED, events.slice(0, -1)).phase).toBe("between");
  });
});

describe("a Test match", () => {
  const close: MatchEvent = { type: "end_innings", declared: true };

  it("runs four innings in the usual order", () => {
    const m = buildMatch(setup(null), TEST, [
      ball(6), close, startDeccan,
      ball(4), close, startShivaji,
      ball(2), close, startDeccan,
    ]);
    expect(m.innings.map((i) => i.state.battingTeam)).toEqual(["Shivaji", "Deccan", "Shivaji", "Deccan"]);
    expect(m.phase).toBe("playing");
  });

  it("has no over limit", () => {
    expect(buildMatch(setup(null), TEST, []).current.maxOvers).toBeNull();
  });

  it("sets no target until the fourth innings", () => {
    const m = buildMatch(setup(null), TEST, [ball(6), close, startDeccan]);
    expect(m.current.target).toBeNull();
  });

  it("sets the fourth-innings target from the lead", () => {
    // Shivaji 6 + 2 = 8, Deccan 4. Deccan need 5.
    const m = buildMatch(setup(null), TEST, [
      ball(6), close, startDeccan, ball(4), close, startShivaji, ball(2), close, startDeccan,
    ]);
    expect(m.current.target).toBe(5);
  });

  it("wins by wickets when the fourth innings reaches the target", () => {
    const m = buildMatch(setup(null), TEST, [
      ball(6), close, startDeccan, ball(4), close, startShivaji, ball(2), close, startDeccan, ball(6),
    ]);
    expect(m.result).toMatchObject({ kind: "wickets", winner: "Deccan", margin: 2 });
  });

  it("wins by runs when the fourth innings is bowled out short", () => {
    const m = buildMatch(setup(null), TEST, [
      ball(6), close, startDeccan, ball(4), close, startShivaji, ball(2), close, startDeccan,
      ball(2), ...allOutAs("d2"),
    ]);
    // Shivaji 8, Deccan 4 + 2 = 6.
    expect(m.result).toMatchObject({ kind: "runs", winner: "Shivaji", margin: 2 });
  });

  it("is a tie when the fourth innings is bowled out level", () => {
    const m = buildMatch(setup(null), TEST, [
      ball(6), close, startDeccan, ball(4), close, startShivaji, close, startDeccan,
      ball(2), ...allOutAs("d2"),
    ]);
    expect(m.result).toMatchObject({ kind: "tie", winner: null });
  });

  it("is a draw when the side at the wicket closes short of the target", () => {
    const m = buildMatch(setup(null), TEST, [
      ball(6), close, startDeccan, ball(4), close, startShivaji, close, startDeccan, ball(1),
      { type: "end_match", outcome: "draw" },
    ]);
    expect(m.result?.kind).toBe("draw");
    expect(m.result?.winner).toBeNull();
  });

  it("wins by an innings when the side batting twice stays behind", () => {
    // Shivaji 2 and 2 = 4. Deccan 6. No fourth innings is needed.
    const m = buildMatch(setup(null), TEST, [
      ball(2), close, startDeccan, ball(6), close, startShivaji, ball(2), ...allOutAs("s2"),
    ]);
    expect(m.phase).toBe("finished");
    expect(m.result).toMatchObject({ kind: "innings", winner: "Deccan", margin: 2 });
  });

  it("needs a fourth innings when the scores are level after three", () => {
    const m = buildMatch(setup(null), TEST, [
      ball(2), close, startDeccan, ball(4), close, startShivaji, ball(2), close,
    ]);
    expect(m.phase).toBe("between");
    expect(m.next?.battingTeam).toBe("Deccan");
    expect(m.next?.target).toBe(1);
  });

  describe("the follow-on", () => {
    it.each([[5, 200], [4, 150], [3, 150], [2, 100], [1, 75]])(
      "a %i-day match needs a lead of %i",
      (days, margin) => expect(followOnMargin(days)).toBe(margin),
    );

    const rules: MatchRules = { format: "test", days: 1 };
    const big = [...bowling(score(100), "d"), close, startDeccan, ...bowling(score(20), "s"), close];

    it("is offered from the Law 14 margin", () => {
      const m = buildMatch(setup(null), rules, big);
      expect(m.phase).toBe("between");
      expect(m.followOnAvailable).toBe(true);
      expect(m.next?.battingTeam).toBe("Shivaji");
    });

    it("is not offered below it", () => {
      const m = buildMatch(setup(null), rules, [
        ...bowling(score(90), "d"), close, startDeccan, ...bowling(score(20), "s"), close,
      ]);
      expect(m.followOnAvailable).toBe(false);
    });

    it("sends the trailing side straight back in when enforced", () => {
      const m = buildMatch(setup(null), rules, [...big, { ...startDeccan, followOn: true }]);
      expect(m.innings.map((i) => i.state.battingTeam)).toEqual(["Shivaji", "Deccan", "Deccan"]);
      expect(m.innings[2].followOn).toBe(true);
    });

    it("refuses a follow-on that was not earned", () => {
      expect(() =>
        buildMatch(setup(null), rules, [ball(2), close, startDeccan, ball(1), close, { ...startDeccan, followOn: true }]),
      ).toThrow();
    });

    it("wins by an innings when the follow-on side is bowled out behind", () => {
      const m = buildMatch(setup(null), rules, [
        ...big, { ...startDeccan, followOn: true }, ball(10 % 7), ...allOutAs("d2"),
      ]);
      expect(m.result).toMatchObject({ kind: "innings", winner: "Shivaji" });
      expect(m.result?.margin).toBe(100 - 20 - 3);
    });

    it("leaves the side that enforced it batting last when it is passed", () => {
      const m = buildMatch(setup(null), rules, [
        ...big, { ...startDeccan, followOn: true }, ...bowling(score(90), "s"), close,
      ]);
      // Deccan 20 + 90 = 110, Shivaji 100. Shivaji need 11.
      expect(m.next?.battingTeam).toBe("Shivaji");
      expect(m.next?.target).toBe(11);
    });
  });
});

describe("the dismissal", () => {
  it("remembers who took the wicket after the bowler changes", () => {
    const m = buildMatch(setup(), LIMITED, [
      ball(0), out, { type: "new_batter", playerId: "s2" },
      ball(0), ball(0), ball(0), ball(0),
      { type: "new_bowler", playerId: "d1" },
    ]);
    expect(m.current.batters.s0.dismissal?.bowlerId).toBe("d0");
    expect(m.current.bowlerId).toBe("d1");
  });
});

describe("rain in a limited-overs match", () => {
  const big = (overs: number): InningsSetup => ({ ...setup(overs), batting: players("s", 11), bowling: players("d", 11) });
  const openDeccan: MatchEvent = { type: "start_innings", strikerId: "d0", nonStrikerId: "d1", bowlerId: "s0" };

  /** Whole overs of singles, with the next bowler named after each. */
  function overs(n: number, bowler: string, runs = 1, finished = false): MatchEvent[] {
    const out: MatchEvent[] = [];
    for (let o = 0; o < n; o++) {
      for (let b = 0; b < 6; b++) out.push(ball(runs));
      if (!(finished && o === n - 1)) out.push({ type: "new_bowler", playerId: bowler });
    }
    return out;
  }

  it("leaves an uninterrupted chase at one more than the score", () => {
    const m = buildMatch(big(10), LIMITED, [...overs(10, "d1", 1, true), openDeccan]);
    expect(m.current.target).toBe(61);
    expect(m.dls?.revised).toBe(false);
  });

  it("cuts a target when Team 2's innings starts short (ICC example 2 method)", () => {
    const m = buildMatch(big(45), { format: "limited", g50: 245 }, [
      ...overs(45, "d1", 1, true),
      { ...openDeccan, maxOvers: 35 },
    ]);
    // 270 x 82.7 / 95.0 = 235.04, so par 235 and target 236.
    expect(m.current.target).toBe(236);
    expect(m.current.maxOvers).toBe(35);
    expect(m.dls?.revised).toBe(true);
  });

  it("raises a target when Team 1 lost more than Team 2 will", () => {
    const m = buildMatch(big(50), { format: "limited", g50: 245 }, [
      ...overs(20, "d1"),
      { type: "reduce_overs", maxOvers: 40 },
      ...overs(20, "d1", 1, true),
      openDeccan,
    ]);
    // 240 runs. R1 = 100 - (75.1 - 56.6) = 81.5 with no wickets, R2 = 89.3.
    // Target = 240 + 245 x 7.8 / 100 + 1 = 260.
    expect(m.current.target).toBe(260);
    expect(m.current.maxOvers).toBe(40);
  });

  it("revises the target during the chase (ICC example 3 method)", () => {
    const m = buildMatch(big(50), { format: "limited", g50: 245 }, [
      ...overs(50, "d1", 5, true),
      openDeccan,
      ...overs(12, "s1", 1),
      { type: "reduce_overs", maxOvers: 40 },
    ]);
    // 1500 runs. 38 left to 28 left at 0 down: 86.7 - 71.8 = 14.9 lost, R2 = 85.1.
    expect(m.current.target).toBe(Math.floor((1500 * 851) / 1000) + 1);
    expect(m.current.maxOvers).toBe(40);
    expect(m.phase).toBe("playing");
  });

  it("wins a revised chase by wickets, marked as DLS", () => {
    const m = buildMatch(big(10), LIMITED, [
      ...overs(10, "d1", 3, true),
      openDeccan,
      ...overs(2, "s1", 6),
      { type: "reduce_overs", maxOvers: 5 },
    ]);
    expect(m.phase).toBe("playing");
    const t = m.current.target ?? 0;
    expect(t).toBeLessThan(181);
    const won = buildMatch(big(10), LIMITED, [
      ...overs(10, "d1", 3, true), openDeccan, ...overs(2, "s1", 6),
      { type: "reduce_overs", maxOvers: 5 },
      ...Array(Math.ceil((t - m.current.runs) / 6)).fill(ball(6)),
    ]);
    expect(won.result).toMatchObject({ kind: "wickets", winner: "Deccan", dls: true });
  });

  it("measures a shortfall from the score needed to tie", () => {
    const m = buildMatch(big(10), LIMITED, [
      ...overs(10, "d1", 1, true),
      { ...openDeccan, maxOvers: 1 },
      ...Array(6).fill(ball(0)),
    ]);
    // 60 x 3.6 / 32.1 = 6.72, so par 6, target 7. Scoring 0 loses by 6.
    expect(m.current.target).toBe(7);
    expect(m.result).toMatchObject({ kind: "runs", winner: "Shivaji", margin: 6, dls: true });
  });

  it("settles a washed-out chase on the par score, in runs for either side", () => {
    const base = [...overs(20, "d1", 1, true), openDeccan];
    const ahead = buildMatch(big(20), LIMITED, [...base, ...overs(5, "s1", 2), { type: "end_match", outcome: "rain" }]);
    // 120 runs. 20 overs 56.6, lost 15 left 0 down 45.2: R2 = 11.4. Par 120 x 11.4 / 56.6 = 24.
    expect(ahead.result).toMatchObject({ kind: "runs", winner: "Deccan", margin: 60 - 24, dls: true });

    const behind = buildMatch(big(20), LIMITED, [...base, ...overs(5, "s1", 0), { type: "end_match", outcome: "rain" }]);
    expect(behind.result).toMatchObject({ kind: "runs", winner: "Shivaji", margin: 24, dls: true });
  });

  it("makes a washed-out chase level on par a tie", () => {
    // Par is 24 after 5 of 20 overs with 120 to chase: 24 singles and 6 dots.
    const five: MatchEvent[] = [];
    for (let o = 0; o < 5; o++) {
      for (let b = 0; b < 6; b++) five.push(ball(o === 4 && b >= 0 ? 0 : b < 6 ? 1 : 0));
      five.push({ type: "new_bowler", playerId: "s1" });
    }
    const m = buildMatch(big(20), LIMITED, [...overs(20, "d1", 2, true), openDeccan, ...five, { type: "end_match", outcome: "rain" }]);
    // 240 to chase, so par is 48 and 24 scored loses; the same logic at 60 runs ties.
    expect(m.result?.kind).toBe("runs");
    const tied = buildMatch(big(20), LIMITED, [...overs(20, "d1", 1, true), openDeccan, ...five, { type: "end_match", outcome: "rain" }]);
    expect(tied.result).toMatchObject({ kind: "tie", winner: null, dls: true });
  });

  it("is no result if the chase has not reached the minimum overs", () => {
    const m = buildMatch(big(20), LIMITED, [...overs(20, "d1", 1, true), openDeccan, ...overs(4, "s1"), { type: "end_match", outcome: "rain" }]);
    expect(m.result?.kind).toBe("abandoned");
    expect(m.result?.dls).toBeUndefined();
  });

  it("is no result if rain ends the match in the first innings", () => {
    const m = buildMatch(big(20), LIMITED, [...overs(4, "d1"), { type: "end_match", outcome: "rain" }]);
    expect(m.result?.kind).toBe("abandoned");
  });

  it("carries a rain-ended first innings into the target (ICC example 5 method)", () => {
    const m = buildMatch(big(20), LIMITED, [...overs(10, "d1"), { type: "end_innings", rain: true }, { ...openDeccan, maxOvers: 10 }]);
    // 60 runs. R1 = 56.6 - 32.1 = 24.5, R2 = 32.1. Target = 60 + 200 x 7.6 / 100 + 1 = 76.
    expect(m.current.target).toBe(76);
  });

  it("ends the innings at once if a cut leaves no overs to bowl", () => {
    const m = buildMatch(big(20), LIMITED, [...overs(5, "d1"), { type: "reduce_overs", maxOvers: 5 }]);
    expect(m.current.complete).toBe(true);
    expect(m.phase).toBe("between");
  });

  it("reaches the result at once if a cut brings the target below the score", () => {
    const m = buildMatch(big(20), LIMITED, [
      ...overs(20, "d1", 1, true), openDeccan, ...overs(5, "s1", 3), { type: "reduce_overs", maxOvers: 5 },
    ]);
    expect(m.result).toMatchObject({ kind: "wickets", winner: "Deccan", dls: true });
  });

  it("offers a live par once the minimum has been bowled, and not before", () => {
    const base = [...overs(20, "d1", 1, true), openDeccan];
    expect(buildMatch(big(20), LIMITED, [...base, ...overs(4, "s1")]).dls?.parNow).toBeNull();
    expect(buildMatch(big(20), LIMITED, [...base, ...overs(5, "s1")]).dls?.parNow).toBe(24);
  });

  it("refuses overs that go up, or fall below what has been bowled", () => {
    const base = overs(5, "d1");
    expect(() => buildMatch(big(20), LIMITED, [...base, { type: "reduce_overs", maxOvers: 25 }])).toThrow();
    expect(() => buildMatch(big(20), LIMITED, [...base, { type: "reduce_overs", maxOvers: 4 }])).toThrow();
  });

  it("undoes a cut exactly", () => {
    const events: MatchEvent[] = [...overs(20, "d1", 1, true), openDeccan, ...overs(5, "s1"), { type: "reduce_overs", maxOvers: 10 }];
    const before = buildMatch(big(20), LIMITED, events);
    const after = buildMatch(big(20), LIMITED, events.slice(0, -1));
    expect(before.current.target).not.toBe(after.current.target);
    expect(after.current.target).toBe(121);
  });

  it("does not apply to a Test", () => {
    expect(() => buildMatch(setup(null), TEST, [{ type: "reduce_overs", maxOvers: 10 }])).toThrow();
  });
});
