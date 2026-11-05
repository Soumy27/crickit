/**
 * The scoring engine.
 *
 * `applyEvent` is pure: same state and event, same result, no mutation. The
 * match is the event log; state is always `buildInnings(setup, log)`. Undo is
 * therefore exact rather than approximate — drop an event and refold.
 */

import {
  BOWLER_CREDITED,
  type BallEvent,
  type BatterFigures,
  type BowlerFigures,
  type InningsSetup,
  type InningsState,
  type MatchEvent,
  type ScorebookMark,
} from "./types";

export const BALLS_PER_OVER = 6;

/** 14 balls reads as 2.2 overs, not 2.33. */
export function oversString(balls: number): string {
  return `${Math.floor(balls / BALLS_PER_OVER)}.${balls % BALLS_PER_OVER}`;
}

export function initialInnings(setup: InningsSetup, target: number | null = null): InningsState {
  const batters: Record<string, BatterFigures> = {};
  for (const p of setup.batting) {
    batters[p.id] = {
      id: p.id,
      name: p.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      batted: false,
    };
  }
  const bowlers: Record<string, BowlerFigures> = {};
  for (const p of setup.bowling) {
    bowlers[p.id] = {
      id: p.id,
      name: p.name,
      balls: 0,
      runs: 0,
      wickets: 0,
      maidens: 0,
    };
  }
  batters[setup.strikerId].batted = true;
  batters[setup.nonStrikerId].batted = true;

  return {
    battingTeam: setup.battingTeam,
    bowlingTeam: setup.bowlingTeam,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0 },
    strikerId: setup.strikerId,
    nonStrikerId: setup.nonStrikerId,
    bowlerId: setup.bowlerId,
    batters,
    bowlers,
    overs: [
      {
        number: 1,
        bowlerId: setup.bowlerId,
        marks: [],
        runs: 0,
        bowlerRuns: 0,
        wickets: 0,
        complete: false,
      },
    ],
    complete: false,
    target,
    declared: false,
    awaiting: [],
    maxOvers: setup.maxOvers,
    // All out is everyone but the last man standing.
    maxWickets: Math.max(1, setup.batting.length - 1),
  };
}

function notate(ev: BallEvent): ScorebookMark {
  const { extra, batRuns, extraRuns, wicket } = ev;
  const legal = extra !== "wide" && extra !== "noball";

  let notation: string;
  let runs: number;

  if (extra === "wide") {
    runs = 1 + extraRuns;
    notation = extraRuns > 0 ? `${runs}wd` : "wd";
  } else if (extra === "noball") {
    runs = 1 + batRuns + extraRuns;
    const off = batRuns + extraRuns;
    notation = off > 0 ? `${off}nb` : "nb";
  } else if (extra === "bye") {
    runs = extraRuns;
    notation = `${extraRuns}b`;
  } else if (extra === "legbye") {
    runs = extraRuns;
    notation = `${extraRuns}lb`;
  } else {
    runs = batRuns;
    notation = batRuns === 0 ? "•" : String(batRuns);
  }

  if (wicket) notation = runs > 0 ? `${runs}W` : "W";

  return { notation, runs, wicket: Boolean(wicket), legal };
}

function cloneForWrite(state: InningsState): InningsState {
  return {
    ...state,
    extras: { ...state.extras },
    batters: { ...state.batters },
    bowlers: { ...state.bowlers },
    overs: state.overs.map((o) => ({ ...o, marks: [...o.marks] })),
    awaiting: [...state.awaiting],
  };
}

function applyBall(state: InningsState, ev: BallEvent): InningsState {
  if (state.complete) {
    throw new Error("The innings is over; no further deliveries.");
  }
  if (state.awaiting.length > 0) {
    throw new Error(
      `Waiting for ${state.awaiting.join(" and ")} before the next delivery.`,
    );
  }
  const strikerId = state.strikerId;
  const nonStrikerId = state.nonStrikerId;
  const bowlerId = state.bowlerId;
  if (!strikerId || !nonStrikerId || !bowlerId) {
    throw new Error("Both batters and a bowler must be set.");
  }
  if (ev.batRuns < 0 || ev.extraRuns < 0) {
    throw new Error("Runs cannot be negative.");
  }
  if ((ev.extra === "wide" || ev.extra === "bye" || ev.extra === "legbye") && ev.batRuns > 0) {
    throw new Error(`A ${ev.extra} scores no runs off the bat.`);
  }
  if (ev.wicket?.who === "non_striker" && ev.wicket.kind !== "run_out") {
    throw new Error("Only a run out can dismiss the non-striker.");
  }

  const s = cloneForWrite(state);
  const extra = ev.extra;
  const isWide = extra === "wide";
  const isNoBall = extra === "noball";
  const isBye = extra === "bye";
  const isLegBye = extra === "legbye";
  const legal = !isWide && !isNoBall;

  // Runs to the side, and runs debited to the bowler. Byes and leg byes are
  // the batting side's; the bowler is not charged for them.
  let teamRuns: number;
  let bowlerRuns: number;
  if (isWide) {
    teamRuns = 1 + ev.extraRuns;
    bowlerRuns = teamRuns;
  } else if (isNoBall) {
    teamRuns = 1 + ev.batRuns + ev.extraRuns;
    bowlerRuns = teamRuns;
  } else if (isBye || isLegBye) {
    teamRuns = ev.extraRuns;
    bowlerRuns = 0;
  } else {
    teamRuns = ev.batRuns;
    bowlerRuns = ev.batRuns;
  }

  s.runs += teamRuns;
  if (isWide) s.extras.wides += 1 + ev.extraRuns;
  if (isNoBall) s.extras.noballs += 1 + ev.extraRuns;
  if (isBye) s.extras.byes += ev.extraRuns;
  if (isLegBye) s.extras.legbyes += ev.extraRuns;

  // The striker faces everything except a wide.
  const striker = { ...s.batters[strikerId] };
  if (!isWide) striker.balls += 1;
  striker.runs += ev.batRuns;
  if (ev.batRuns === 4) striker.fours += 1;
  if (ev.batRuns === 6) striker.sixes += 1;
  s.batters[striker.id] = striker;

  const bowler = { ...s.bowlers[bowlerId] };
  if (legal) bowler.balls += 1;
  bowler.runs += bowlerRuns;
  if (ev.wicket && BOWLER_CREDITED.includes(ev.wicket.kind)) bowler.wickets += 1;
  s.bowlers[bowler.id] = bowler;

  if (legal) s.legalBalls += 1;

  const over = s.overs[s.overs.length - 1];
  over.marks.push(notate(ev));
  over.runs += teamRuns;
  over.bowlerRuns += bowlerRuns;

  // Runs actually run between the wickets decide the strike.
  const runsRun =
    isWide || isBye || isLegBye ? ev.extraRuns : ev.batRuns + ev.extraRuns;
  let striking: string | null = strikerId;
  let nonStriking: string | null = nonStrikerId;
  if (runsRun % 2 === 1) [striking, nonStriking] = [nonStriking, striking];

  if (ev.wicket) {
    s.wickets += 1;
    over.wickets += 1;
    const outId = ev.wicket.who === "striker" ? strikerId : nonStrikerId;
    const outBatter = {
      ...s.batters[outId],
      out: true,
      dismissal: { ...ev.wicket, bowlerId },
    };
    s.batters[outId] = outBatter;
    // The incoming batter takes the dismissed batter's end.
    if (outId === striking) striking = null;
    else nonStriking = null;
  }

  const oversDone =
    s.maxOvers !== null && s.legalBalls >= s.maxOvers * BALLS_PER_OVER;
  const allOut = s.wickets >= s.maxWickets;

  const overComplete = legal && over.marks.filter((m) => m.legal).length >= BALLS_PER_OVER;
  if (overComplete) {
    over.complete = true;
    if (over.bowlerRuns === 0) {
      s.bowlers[bowler.id] = { ...s.bowlers[bowler.id], maidens: s.bowlers[bowler.id].maidens + 1 };
    }
    // Ends change, so the batters swap again.
    [striking, nonStriking] = [nonStriking, striking];
  }

  s.strikerId = striking;
  s.nonStrikerId = nonStriking;

  const targetReached = s.target !== null && s.runs >= s.target;

  if (allOut || oversDone || targetReached) {
    s.complete = true;
    s.awaiting = [];
    return s;
  }

  if (s.strikerId === null || s.nonStrikerId === null) s.awaiting.push("new_batter");
  if (overComplete) {
    s.awaiting.push("new_bowler");
    s.overs.push({
      number: s.overs.length + 1,
      bowlerId: "",
      marks: [],
      runs: 0,
      bowlerRuns: 0,
      wickets: 0,
      complete: false,
    });
  }

  return s;
}

export function applyEvent(state: InningsState, event: MatchEvent): InningsState {
  switch (event.type) {
    case "ball":
      return applyBall(state, event);

    case "new_batter": {
      if (!state.awaiting.includes("new_batter")) {
        throw new Error("No batter is due.");
      }
      const incoming = state.batters[event.playerId];
      if (!incoming) throw new Error(`Unknown player ${event.playerId}.`);
      if (incoming.out) throw new Error(`${incoming.name} is already out.`);
      if (incoming.id === state.strikerId || incoming.id === state.nonStrikerId) {
        throw new Error(`${incoming.name} is already at the crease.`);
      }
      const s = cloneForWrite(state);
      s.batters[incoming.id] = { ...incoming, batted: true };
      if (s.strikerId === null) s.strikerId = incoming.id;
      else s.nonStrikerId = incoming.id;
      s.awaiting = s.awaiting.filter((a) => a !== "new_batter");
      return s;
    }

    case "new_bowler": {
      if (!state.awaiting.includes("new_bowler")) {
        throw new Error("No bowler is due.");
      }
      if (!state.bowlers[event.playerId]) {
        throw new Error(`Unknown player ${event.playerId}.`);
      }
      const s = cloneForWrite(state);
      s.bowlerId = event.playerId;
      s.overs[s.overs.length - 1].bowlerId = event.playerId;
      s.awaiting = s.awaiting.filter((a) => a !== "new_bowler");
      return s;
    }

    case "end_innings": {
      const s = cloneForWrite(state);
      s.complete = true;
      s.declared = Boolean(event.declared);
      s.awaiting = [];
      return s;
    }

    case "start_innings":
    case "reduce_overs":
    case "end_match":
      throw new Error(`${event.type} belongs to the match, not to an innings.`);
  }
}

export function buildInnings(
  setup: InningsSetup,
  events: readonly MatchEvent[],
): InningsState {
  return events.reduce<InningsState>(applyEvent, initialInnings(setup));
}

/** Undo is a refold of one fewer event, so it is exact by construction. */
export function undo(
  setup: InningsSetup,
  events: readonly MatchEvent[],
): { state: InningsState; events: MatchEvent[] } {
  const next = events.slice(0, -1);
  return { state: buildInnings(setup, next), events: next };
}

export function runRate(state: InningsState): number {
  if (state.legalBalls === 0) return 0;
  return (state.runs / state.legalBalls) * BALLS_PER_OVER;
}

export function strikeRate(b: BatterFigures): number {
  if (b.balls === 0) return 0;
  return (b.runs / b.balls) * 100;
}

export function economy(b: BowlerFigures): number {
  if (b.balls === 0) return 0;
  return (b.runs / b.balls) * BALLS_PER_OVER;
}

/** "Rohit 34 (22)" — the line a scorecard prints. */
export function batterLine(b: BatterFigures): string {
  return `${b.name} ${b.runs} (${b.balls})`;
}

/** "Jadeja 4-0-23-2" */
export function bowlerLine(b: BowlerFigures): string {
  return `${b.name} ${oversString(b.balls)}-${b.maidens}-${b.runs}-${b.wickets}`;
}
