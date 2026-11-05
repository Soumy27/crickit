import { describe, expect, it } from "vitest";
import {
  applyEvent,
  batterLine,
  bowlerLine,
  buildInnings,
  economy,
  initialInnings,
  oversString,
  runRate,
  strikeRate,
  undo,
} from "./engine";
import type { BallEvent, InningsSetup, MatchEvent } from "./types";

const batting = [
  { id: "b1", name: "Rohit" },
  { id: "b2", name: "Imran" },
  { id: "b3", name: "Suresh" },
  { id: "b4", name: "Anil" },
];
const bowling = [
  { id: "o1", name: "Jadeja" },
  { id: "o2", name: "Faisal" },
];

const setup: InningsSetup = {
  battingTeam: "Shivaji XI",
  bowlingTeam: "Deccan Club",
  batting,
  bowling,
  strikerId: "b1",
  nonStrikerId: "b2",
  bowlerId: "o1",
  maxOvers: 2,
};

/** A delivery, with the boring fields filled in. */
function ball(p: Partial<BallEvent> = {}): BallEvent {
  return { type: "ball", batRuns: 0, extraRuns: 0, ...p };
}

const dot = () => ball();

function play(events: MatchEvent[], s: InningsSetup = setup) {
  return buildInnings(s, events);
}

describe("openings", () => {
  it("opens with both batters in and nothing scored", () => {
    const s = initialInnings(setup);
    expect(s.runs).toBe(0);
    expect(s.wickets).toBe(0);
    expect(s.legalBalls).toBe(0);
    expect(s.strikerId).toBe("b1");
    expect(s.batters.b1.batted).toBe(true);
    expect(s.batters.b3.batted).toBe(false);
    expect(s.maxWickets).toBe(3);
  });
});

describe("runs off the bat", () => {
  it("counts a dot as a ball faced and nothing else", () => {
    const s = play([dot()]);
    expect(s.runs).toBe(0);
    expect(s.legalBalls).toBe(1);
    expect(s.batters.b1.balls).toBe(1);
    expect(s.overs[0].marks[0].notation).toBe("•");
  });

  it("swaps the strike on an odd number of runs", () => {
    const s = play([ball({ batRuns: 1 })]);
    expect(s.strikerId).toBe("b2");
    expect(s.batters.b1.runs).toBe(1);
  });

  it("keeps the strike on an even number", () => {
    const s = play([ball({ batRuns: 2 })]);
    expect(s.strikerId).toBe("b1");
  });

  it("records a four and a six", () => {
    const s = play([ball({ batRuns: 4 }), ball({ batRuns: 6 })]);
    expect(s.runs).toBe(10);
    expect(s.batters.b1.fours).toBe(1);
    expect(s.batters.b1.sixes).toBe(1);
    expect(s.bowlers.o1.runs).toBe(10);
  });
});

describe("wides", () => {
  it("adds a run, is not a legal ball, and is not faced", () => {
    const s = play([ball({ extra: "wide" })]);
    expect(s.runs).toBe(1);
    expect(s.legalBalls).toBe(0);
    expect(s.batters.b1.balls).toBe(0);
    expect(s.extras.wides).toBe(1);
    expect(s.bowlers.o1.runs).toBe(1);
    expect(s.bowlers.o1.balls).toBe(0);
  });

  it("carries the runs run, and those decide the strike", () => {
    const s = play([ball({ extra: "wide", extraRuns: 1 })]);
    expect(s.runs).toBe(2);
    expect(s.extras.wides).toBe(2);
    expect(s.strikerId).toBe("b2");
  });

  it("refuses runs off the bat", () => {
    expect(() => play([ball({ extra: "wide", batRuns: 2 })])).toThrow(/off the bat/);
  });
});

describe("no-balls", () => {
  it("adds the penalty, is faced, but is not a legal ball", () => {
    const s = play([ball({ extra: "noball" })]);
    expect(s.runs).toBe(1);
    expect(s.legalBalls).toBe(0);
    expect(s.batters.b1.balls).toBe(1);
    expect(s.bowlers.o1.balls).toBe(0);
  });

  it("credits runs off the bat to the batter and charges the bowler for all of it", () => {
    const s = play([ball({ extra: "noball", batRuns: 4 })]);
    expect(s.runs).toBe(5);
    expect(s.batters.b1.runs).toBe(4);
    expect(s.batters.b1.fours).toBe(1);
    expect(s.bowlers.o1.runs).toBe(5);
    expect(s.overs[0].marks[0].notation).toBe("4nb");
  });
});

describe("byes and leg byes", () => {
  it("gives byes to the side, not the bowler, and still uses up a ball", () => {
    const s = play([ball({ extra: "bye", extraRuns: 2 })]);
    expect(s.runs).toBe(2);
    expect(s.extras.byes).toBe(2);
    expect(s.legalBalls).toBe(1);
    expect(s.batters.b1.balls).toBe(1);
    expect(s.batters.b1.runs).toBe(0);
    expect(s.bowlers.o1.runs).toBe(0);
  });

  it("rotates the strike on an odd leg bye", () => {
    const s = play([ball({ extra: "legbye", extraRuns: 1 })]);
    expect(s.extras.legbyes).toBe(1);
    expect(s.strikerId).toBe("b2");
  });
});

describe("overs", () => {
  it("completes after six legal balls and changes the ends", () => {
    const s = play([dot(), dot(), dot(), dot(), dot(), dot()]);
    expect(s.legalBalls).toBe(6);
    expect(s.overs[0].complete).toBe(true);
    expect(s.awaiting).toContain("new_bowler");
    // Ends change, so the non-striker is now on strike.
    expect(s.strikerId).toBe("b2");
  });

  it("does not let wides and no-balls shorten the over", () => {
    const s = play([
      ball({ extra: "wide" }),
      ball({ extra: "noball" }),
      dot(),
      dot(),
      dot(),
      dot(),
      dot(),
    ]);
    expect(s.legalBalls).toBe(5);
    expect(s.overs[0].complete).toBe(false);
  });

  it("counts a maiden when the bowler concedes nothing", () => {
    const s = play([dot(), dot(), dot(), dot(), dot(), dot()]);
    expect(s.bowlers.o1.maidens).toBe(1);
  });

  it("still counts a maiden when the only runs were byes", () => {
    const s = play([
      ball({ extra: "bye", extraRuns: 2 }),
      dot(),
      dot(),
      dot(),
      dot(),
      dot(),
    ]);
    expect(s.runs).toBe(2);
    expect(s.bowlers.o1.runs).toBe(0);
    expect(s.bowlers.o1.maidens).toBe(1);
  });

  it("does not count a maiden when a wide was bowled", () => {
    const s = play([
      ball({ extra: "wide" }),
      dot(),
      dot(),
      dot(),
      dot(),
      dot(),
      dot(),
    ]);
    expect(s.bowlers.o1.maidens).toBe(0);
  });

  it("leaves the striker in place when a single is taken off the last ball", () => {
    // The single swaps the ends, then the over swaps them back.
    const s = play([dot(), dot(), dot(), dot(), dot(), ball({ batRuns: 1 })]);
    expect(s.strikerId).toBe("b1");
  });
});

describe("wickets", () => {
  it("credits the bowler for a bowled and waits for the next batter", () => {
    const s = play([ball({ wicket: { kind: "bowled", who: "striker" } })]);
    expect(s.wickets).toBe(1);
    expect(s.bowlers.o1.wickets).toBe(1);
    expect(s.batters.b1.out).toBe(true);
    expect(s.strikerId).toBeNull();
    expect(s.awaiting).toEqual(["new_batter"]);
  });

  it("does not credit the bowler for a run out", () => {
    const s = play([ball({ wicket: { kind: "run_out", who: "striker" } })]);
    expect(s.wickets).toBe(1);
    expect(s.bowlers.o1.wickets).toBe(0);
  });

  it("lets a run out take the non-striker", () => {
    const s = play([
      ball({ wicket: { kind: "run_out", who: "non_striker" } }),
    ]);
    expect(s.batters.b2.out).toBe(true);
    expect(s.strikerId).toBe("b1");
    expect(s.nonStrikerId).toBeNull();
  });

  it("refuses any other dismissal for the non-striker", () => {
    expect(() =>
      play([ball({ wicket: { kind: "bowled", who: "non_striker" } })]),
    ).toThrow(/run out/);
  });

  it("can fall on a no-ball, without the bowler getting the wicket", () => {
    const s = play([
      ball({ extra: "noball", wicket: { kind: "run_out", who: "striker" } }),
    ]);
    expect(s.runs).toBe(1);
    expect(s.legalBalls).toBe(0);
    expect(s.wickets).toBe(1);
    expect(s.bowlers.o1.wickets).toBe(0);
  });

  it("brings the new batter in at the fallen batter's end", () => {
    const s = play([
      ball({ wicket: { kind: "bowled", who: "striker" } }),
      { type: "new_batter", playerId: "b3" },
    ]);
    expect(s.strikerId).toBe("b3");
    expect(s.nonStrikerId).toBe("b2");
    expect(s.awaiting).toEqual([]);
  });

  it("refuses a batter who is already out or already in", () => {
    const after = play([ball({ wicket: { kind: "bowled", who: "striker" } })]);
    expect(() => applyEvent(after, { type: "new_batter", playerId: "b1" })).toThrow(
      /already out/,
    );
    expect(() => applyEvent(after, { type: "new_batter", playerId: "b2" })).toThrow(
      /already at the crease/,
    );
  });
});

describe("the end of an innings", () => {
  it("ends when the side is all out", () => {
    const out = ball({ wicket: { kind: "bowled", who: "striker" } });
    const s = play([
      out,
      { type: "new_batter", playerId: "b3" },
      out,
      { type: "new_batter", playerId: "b4" },
      out,
    ]);
    expect(s.wickets).toBe(3);
    expect(s.complete).toBe(true);
    expect(s.awaiting).toEqual([]);
  });

  it("ends when the overs run out", () => {
    const over = [dot(), dot(), dot(), dot(), dot(), dot()];
    const s = play([
      ...over,
      { type: "new_bowler", playerId: "o2" },
      ...over,
    ]);
    expect(s.legalBalls).toBe(12);
    expect(s.complete).toBe(true);
  });

  it("refuses another delivery once it is over", () => {
    const over = [dot(), dot(), dot(), dot(), dot(), dot()];
    const s = play([...over, { type: "new_bowler", playerId: "o2" }, ...over]);
    expect(() => applyEvent(s, dot())).toThrow(/innings is over/);
  });

  it("refuses a delivery while a batter or bowler is owed", () => {
    const s = play([ball({ wicket: { kind: "bowled", who: "striker" } })]);
    expect(() => applyEvent(s, dot())).toThrow(/Waiting for/);
  });
});

describe("undo", () => {
  it("is exact, because it refolds the log", () => {
    const log: MatchEvent[] = [ball({ batRuns: 4 }), ball({ batRuns: 1 })];
    const before = play([log[0]]);
    const { state, events } = undo(setup, log);
    expect(events).toHaveLength(1);
    expect(state).toEqual(before);
  });

  it("takes back a wicket cleanly", () => {
    const log: MatchEvent[] = [
      ball({ batRuns: 2 }),
      ball({ wicket: { kind: "caught", who: "striker", fielder: "Imran" } }),
    ];
    const { state } = undo(setup, log);
    expect(state.wickets).toBe(0);
    expect(state.batters.b1.out).toBe(false);
    expect(state.bowlers.o1.wickets).toBe(0);
    expect(state.awaiting).toEqual([]);
  });
});

describe("the numbers a scorecard prints", () => {
  it("reads overs as 2.2, not 2.33", () => {
    expect(oversString(0)).toBe("0.0");
    expect(oversString(14)).toBe("2.2");
    expect(oversString(12)).toBe("2.0");
  });

  it("formats the batting and bowling lines", () => {
    const s = play([ball({ batRuns: 4 }), ball({ batRuns: 2 })]);
    expect(batterLine(s.batters.b1)).toBe("Rohit 6 (2)");
    expect(bowlerLine(s.bowlers.o1)).toBe("Jadeja 0.2-0-6-0");
  });

  it("computes rates", () => {
    const s = play([ball({ batRuns: 4 }), ball({ batRuns: 2 })]);
    expect(runRate(s)).toBe(18);
    expect(strikeRate(s.batters.b1)).toBe(300);
    expect(economy(s.bowlers.o1)).toBe(18);
    expect(strikeRate(s.batters.b3)).toBe(0);
  });
});

describe("a whole over, narrated", () => {
  it("adds up the way a scorer would write it", () => {
    // . 4 wd 1 . W . 2  →  4 + 1(wd) + 1 + 2 = 8 for 1
    const s = play([
      dot(),
      ball({ batRuns: 4 }),
      ball({ extra: "wide" }),
      ball({ batRuns: 1 }),
      dot(),
      ball({ wicket: { kind: "caught", who: "striker", fielder: "Faisal" } }),
      { type: "new_batter", playerId: "b3" },
      ball({ batRuns: 2 }),
    ]);
    expect(s.runs).toBe(8);
    expect(s.wickets).toBe(1);
    expect(s.legalBalls).toBe(6);
    expect(s.overs[0].complete).toBe(true);
    expect(s.overs[0].marks.map((m) => m.notation)).toEqual([
      "•",
      "4",
      "wd",
      "1",
      "•",
      "W",
      "2",
    ]);
    expect(bowlerLine(s.bowlers.o1)).toBe("Jadeja 1.0-0-8-1");
  });
});
