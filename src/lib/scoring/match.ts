/**
 * A whole match, on top of the innings engine.
 *
 * Still one flat event log and still a pure fold, so undo works across an
 * innings break the same way it works on a dot ball. This module owns what an
 * innings cannot know: who bats next, what the target is, and who won.
 *
 * Follow-on margins are MCC Law 14. Rain targets come from dls.ts.
 */

import {
  G50_CLUB,
  inningsResources,
  MAX_DLS_OVERS,
  minimumOvers,
  parScore,
  type Suspension,
} from "./dls";
import { applyEvent, initialInnings } from "./engine";
import type { InningsSetup, InningsState, MatchEvent, Player } from "./types";

export type MatchFormat = "limited" | "test";

export interface MatchRules {
  format: MatchFormat;
  /** Scheduled days, which set the follow-on margin. Test matches. */
  days?: number;
  /** Overrides the club default for the DLS extra-resources calculation. */
  g50?: number;
}

export interface InningsEntry {
  number: number;
  setup: InningsSetup;
  state: InningsState;
  followOn: boolean;
  suspensions: Suspension[];
}

export type ResultKind = "runs" | "wickets" | "innings" | "tie" | "draw" | "abandoned";

export interface MatchResult {
  kind: ResultKind;
  winner: string | null;
  /** Runs, wickets in hand, or the runs on top of the innings. Zero if none. */
  margin: number;
  /** Decided on a rain-revised target or par score. */
  dls?: boolean;
}

export interface DlsState {
  /** Tenths of a percent. */
  r1: number;
  r2: number;
  /** The score Team 2 would be judged against if rain ended the match now. */
  parNow: number | null;
  /** The target differs from one more than Team 1's score. */
  revised: boolean;
}

export interface NextInnings {
  battingTeam: string;
  bowlingTeam: string;
  batting: Player[];
  bowling: Player[];
  target: number | null;
}

export type MatchPhase = "playing" | "between" | "finished";

export interface MatchState {
  rules: MatchRules;
  innings: InningsEntry[];
  current: InningsState;
  phase: MatchPhase;
  /** Who bats next if the follow-on is not enforced. Null unless between innings. */
  next: NextInnings | null;
  /** The side batting second may be sent back in. Next is then the choice not to. */
  followOnAvailable: boolean;
  /** Only meaningful when followOnAvailable: the side that would bat again. */
  followOnNext: NextInnings | null;
  result: MatchResult | null;
  /** Rain figures for the chase. Null outside a limited-overs second innings. */
  dls: DlsState | null;
  /** Rain rules apply: limited overs, with a known length of 50 or fewer. */
  rainRules: boolean;
}

const LIMITED: MatchRules = { format: "limited" };

/** Law 14: how far ahead a side must be to enforce the follow-on. */
export function followOnMargin(days = 5): number {
  if (days >= 5) return 200;
  if (days >= 3) return 150;
  if (days === 2) return 100;
  return 75;
}

function inningsLimit(rules: MatchRules): number {
  return rules.format === "test" ? 4 : 2;
}

/** Runs per team name across every innings so far. */
function totals(innings: readonly InningsEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const i of innings) {
    out.set(i.state.battingTeam, (out.get(i.state.battingTeam) ?? 0) + i.state.runs);
  }
  return out;
}

/** The side that has not batted as often, or, if level, the other side from last. */
function nextSide(setup: InningsSetup, innings: readonly InningsEntry[]): "first" | "second" {
  const batted = (team: string) => innings.filter((i) => i.state.battingTeam === team).length;
  return batted(setup.battingTeam) <= batted(setup.bowlingTeam) ? "first" : "second";
}

function describeNext(
  setup: InningsSetup,
  side: "first" | "second",
  target: number | null,
): NextInnings {
  return side === "first"
    ? {
        battingTeam: setup.battingTeam, bowlingTeam: setup.bowlingTeam,
        batting: setup.batting, bowling: setup.bowling, target,
      }
    : {
        battingTeam: setup.bowlingTeam, bowlingTeam: setup.battingTeam,
        batting: setup.bowling, bowling: setup.batting, target,
      };
}

function canUseDls(rules: MatchRules, setup: InningsSetup): boolean {
  return (
    rules.format === "limited" &&
    setup.maxOvers !== null &&
    setup.maxOvers <= MAX_DLS_OVERS
  );
}

/** Team 1's and Team 2's resources, tenths of a percent. */
function resourcesFor(
  setup: InningsSetup,
  first: InningsEntry,
  secondOvers: number,
  secondSuspensions: readonly Suspension[],
): { r1: number; r2: number } {
  return {
    r1: inningsResources(setup.maxOvers ?? 0, first.suspensions),
    r2: inningsResources(secondOvers, secondSuspensions),
  };
}

function targetFor(
  setup: InningsSetup,
  rules: MatchRules,
  innings: readonly InningsEntry[],
  nextTeam: string,
  overs?: number | null,
): number | null {
  // Only the innings that closes the match can be won outright.
  if (innings.length !== inningsLimit(rules) - 1) return null;
  if (rules.format === "limited" && canUseDls(rules, setup)) {
    const first = innings[0];
    const secondOvers = overs ?? first.state.maxOvers ?? setup.maxOvers ?? 0;
    const { r1, r2 } = resourcesFor(setup, first, secondOvers, []);
    return parScore(first.state.runs, r1, r2, rules.g50 ?? G50_CLUB) + 1;
  }
  const t = totals(innings);
  let theirs = 0;
  for (const [team, runs] of t) if (team !== nextTeam) theirs = runs;
  return theirs - (t.get(nextTeam) ?? 0) + 1;
}

/** The result, once one can be declared from completed innings alone. */
function settledResult(
  setup: InningsSetup,
  rules: MatchRules,
  innings: readonly InningsEntry[],
): MatchResult | null {
  const last = innings[innings.length - 1];
  if (!last.state.complete) {
    return null;
  }
  const limit = inningsLimit(rules);
  const t = totals(innings);
  const runs = (team: string) => t.get(team) ?? 0;

  // Three completed in a Test: the side that batted twice may still be behind.
  if (rules.format === "test" && innings.length === 3) {
    const twice = last.state.battingTeam;
    const once = twice === setup.battingTeam ? setup.bowlingTeam : setup.battingTeam;
    if (runs(twice) < runs(once)) {
      return { kind: "innings", winner: once, margin: runs(once) - runs(twice) };
    }
    return null;
  }

  if (innings.length < limit) return null;

  const chasing = last.state.battingTeam;
  const defending = last.state.bowlingTeam;

  // Limited overs: judged on the target, which rain may have moved. If Team 2
  // falls short the margin is measured from the score needed to tie.
  if (rules.format === "limited" && last.state.target !== null) {
    const target = last.state.target;
    const dls = target !== runs(defending) + 1 || last.suspensions.length > 0 ||
      innings[0].suspensions.length > 0;
    const flag = dls ? { dls: true } : {};
    if (last.state.runs >= target) {
      return { kind: "wickets", winner: chasing, margin: last.state.maxWickets - last.state.wickets, ...flag };
    }
    if (last.state.runs === target - 1) return { kind: "tie", winner: null, margin: 0, ...flag };
    return { kind: "runs", winner: defending, margin: target - 1 - last.state.runs, ...flag };
  }

  if (runs(chasing) > runs(defending)) {
    return {
      kind: "wickets",
      winner: chasing,
      margin: last.state.maxWickets - last.state.wickets,
    };
  }
  if (runs(chasing) === runs(defending)) {
    // A Test ends level only if the last side is out; closing level is a draw.
    if (rules.format === "test" && last.state.wickets < last.state.maxWickets) {
      return { kind: "draw", winner: null, margin: 0 };
    }
    return { kind: "tie", winner: null, margin: 0 };
  }
  // Short of the target: bowled out loses, but closing a Test early draws it.
  if (rules.format === "test" && last.state.wickets < last.state.maxWickets) {
    return { kind: "draw", winner: null, margin: 0 };
  }
  return { kind: "runs", winner: defending, margin: runs(defending) - runs(chasing) };
}

function canFollowOn(rules: MatchRules, innings: readonly InningsEntry[]): boolean {
  if (rules.format !== "test" || innings.length !== 2) return false;
  const [first, second] = innings;
  return first.state.runs - second.state.runs >= followOnMargin(rules.days);
}

export function buildMatch(
  setup: InningsSetup,
  rules: MatchRules | undefined,
  events: readonly MatchEvent[],
): MatchState {
  const r = rules ?? LIMITED;
  const innings: InningsEntry[] = [
    { number: 1, setup, state: initialInnings(setup), followOn: false, suspensions: [] },
  ];
  let ended: MatchResult | null = null;

  const current = () => innings[innings.length - 1];
  const g50 = r.g50 ?? G50_CLUB;
  const rainRules = canUseDls(r, setup);
  const ballsLeft = (st: InningsState) => (st.maxOvers ?? 0) * 6 - st.legalBalls;

  /** Team 1's total and both resource figures, for the second innings as it stands. */
  const chaseFigures = (extra: Suspension[] = []) => {
    const second = innings[1];
    return {
      s: innings[0].state.runs,
      ...resourcesFor(setup, innings[0], second.setup.maxOvers ?? 0, [...second.suspensions, ...extra]),
    };
  };

  for (const event of events) {
    if (ended || settledResult(setup, r, innings)) {
      throw new Error("The match is over.");
    }

    if (event.type === "end_match") {
      if (event.outcome !== "rain") {
        ended = { kind: event.outcome, winner: null, margin: 0 };
        continue;
      }
      if (!rainRules) throw new Error("Rain rules are for limited-overs matches.");
      const inChase = innings.length === 2 && !current().state.complete;
      const needed = minimumOvers(setup.maxOvers ?? 0);
      const allowed = Math.min(needed, current().setup.maxOvers ?? needed);
      if (!inChase || current().state.legalBalls < allowed * 6) {
        ended = { kind: "abandoned", winner: null, margin: 0 };
        continue;
      }
      const st = current().state;
      const { s, r1, r2 } = chaseFigures([
        { ballsBefore: ballsLeft(st), ballsAfter: 0, wickets: st.wickets },
      ]);
      const par = parScore(s, r1, r2, g50);
      if (st.runs === par) ended = { kind: "tie", winner: null, margin: 0, dls: true };
      else {
        ended = {
          kind: "runs",
          winner: st.runs > par ? st.battingTeam : st.bowlingTeam,
          margin: Math.abs(st.runs - par),
          dls: true,
        };
      }
      continue;
    }

    if (event.type === "reduce_overs") {
      if (!rainRules) throw new Error("Rain rules are for limited-overs matches.");
      const entry = current();
      const st = entry.state;
      if (st.complete) throw new Error("The innings is over.");
      const was = st.maxOvers ?? 0;
      if (!Number.isInteger(event.maxOvers) || event.maxOvers >= was || event.maxOvers * 6 < st.legalBalls) {
        throw new Error("Overs can only come down, and not below what has been bowled.");
      }
      entry.suspensions = [
        ...entry.suspensions,
        { ballsBefore: ballsLeft(st), ballsAfter: event.maxOvers * 6 - st.legalBalls, wickets: st.wickets },
      ];
      const next: InningsState = { ...st, maxOvers: event.maxOvers };
      if (innings.length === 2) {
        const { s, r1, r2 } = chaseFigures();
        next.target = parScore(s, r1, r2, g50) + 1;
      }
      const reached = next.target !== null && next.runs >= next.target;
      if (reached || next.legalBalls >= event.maxOvers * 6) {
        next.complete = true;
        next.awaiting = [];
      }
      entry.state = next;
      continue;
    }

    if (event.type === "start_innings") {
      if (!current().state.complete) throw new Error("The innings is still going.");
      if (innings.length >= inningsLimit(r)) throw new Error("No more innings in this match.");
      if (event.followOn && !canFollowOn(r, innings)) {
        throw new Error("The follow-on is not available.");
      }

      const team = event.followOn
        ? current().state.battingTeam
        : describeNext(setup, nextSide(setup, innings), null).battingTeam;
      if (event.maxOvers !== undefined) {
        if (
          !rainRules || !Number.isInteger(event.maxOvers) || event.maxOvers < 1 ||
          event.maxOvers > (setup.maxOvers ?? 0)
        ) {
          throw new Error("Those overs do not fit this match.");
        }
      }
      const overs = event.maxOvers ?? (r.format === "limited" ? current().state.maxOvers : setup.maxOvers);
      const target = targetFor(setup, r, innings, team, overs);
      const next = describeNext(setup, team === setup.battingTeam ? "first" : "second", target);

      const known = (list: Player[], id: string) => list.some((p) => p.id === id);
      if (
        !known(next.batting, event.strikerId) ||
        !known(next.batting, event.nonStrikerId) ||
        event.strikerId === event.nonStrikerId ||
        !known(next.bowling, event.bowlerId)
      ) {
        throw new Error("Those players cannot open this innings.");
      }

      const inningsSetup: InningsSetup = {
        battingTeam: next.battingTeam,
        bowlingTeam: next.bowlingTeam,
        batting: next.batting,
        bowling: next.bowling,
        strikerId: event.strikerId,
        nonStrikerId: event.nonStrikerId,
        bowlerId: event.bowlerId,
        maxOvers: overs,
      };
      innings.push({
        number: innings.length + 1,
        setup: inningsSetup,
        state: initialInnings(inningsSetup, target),
        followOn: Boolean(event.followOn),
        suspensions: [],
      });
      continue;
    }

    if (event.type === "end_innings" && event.rain) {
      if (!rainRules) throw new Error("Rain rules are for limited-overs matches.");
      const entry = current();
      entry.suspensions = [
        ...entry.suspensions,
        { ballsBefore: ballsLeft(entry.state), ballsAfter: 0, wickets: entry.state.wickets },
      ];
    }

    current().state = applyEvent(current().state, event);
  }

  const result = ended ?? settledResult(setup, r, innings);
  const state = current().state;
  const phase: MatchPhase = result ? "finished" : state.complete ? "between" : "playing";

  let next: NextInnings | null = null;
  let followOnNext: NextInnings | null = null;
  let followOnAvailable = false;
  if (phase === "between") {
    const side = nextSide(setup, innings);
    const team = side === "first" ? setup.battingTeam : setup.bowlingTeam;
    next = describeNext(setup, side, targetFor(setup, r, innings, team));
    followOnAvailable = canFollowOn(r, innings);
    if (followOnAvailable) {
      const again = state.battingTeam;
      followOnNext = describeNext(
        setup,
        again === setup.battingTeam ? "first" : "second",
        targetFor(setup, r, innings, again),
      );
    }
  }

  let dls: DlsState | null = null;
  if (rainRules && innings.length === 2) {
    const entry = innings[1];
    const { s, r1, r2 } = chaseFigures();
    const allowed = Math.min(minimumOvers(setup.maxOvers ?? 0), entry.setup.maxOvers ?? 0);
    const live = phase === "playing" && state.legalBalls >= allowed * 6;
    const lost = chaseFigures([{ ballsBefore: ballsLeft(state), ballsAfter: 0, wickets: state.wickets }]);
    dls = {
      r1,
      r2,
      parNow: live ? parScore(s, lost.r1, lost.r2, g50) : null,
      revised: state.target !== s + 1,
    };
  }

  return {
    rules: r, innings, current: state, phase, next, followOnAvailable, followOnNext, result, dls, rainRules,
  };
}

/** The target a second innings of this many overs would chase. For the rain form. */
export function targetForOvers(
  setup: InningsSetup,
  match: MatchState,
  overs: number,
): number | null {
  if (!match.next) return null;
  return targetFor(setup, match.rules, match.innings, match.next.battingTeam, overs);
}

/** What the side chasing still needs. */
export function chase(state: InningsState): { runs: number; balls: number | null } | null {
  if (state.target === null) return null;
  const runs = Math.max(0, state.target - state.runs);
  const balls = state.maxOvers === null ? null : Math.max(0, state.maxOvers * 6 - state.legalBalls);
  return { runs, balls };
}

/** Team totals, for the lead shown between Test innings. */
export function teamTotals(match: MatchState): Map<string, number> {
  return totals(match.innings);
}
