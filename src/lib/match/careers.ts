/**
 * Career records.
 *
 * This is the point of the product rather than a feature of it: a club
 * cricketer in a small town has no record of anything they have ever done,
 * because nobody had four hours to sit and tap a phone. Once the scoring is
 * free, the record is a by-product.
 *
 * Careers are recomputed by folding every stored match rather than kept as a
 * running aggregate. With a season of matches that is a few milliseconds, and
 * it means a correction to the engine — or an undone ball — is reflected
 * everywhere at once instead of leaving a stale total behind.
 */

import { oversString } from "../scoring/engine";
import { buildMatch, type MatchState } from "../scoring/match";
import type { DismissalKind } from "../scoring/types";
import { listMatches, loadMatch, type StoredMatch } from "./store";

export interface CareerBatting {
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  notOuts: number;
  /** Highest score, with a star when it was unbeaten. */
  best: number;
  bestNotOut: boolean;
  fifties: number;
  hundreds: number;
  /** How they have got out, by kind. */
  dismissals?: Partial<Record<DismissalKind, number>>;
}

export interface CareerBowling {
  innings: number;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  /** Best figures in an innings, compared on wickets then runs. */
  bestWickets: number;
  bestRuns: number;
}

export interface CareerAppearance {
  matchId: string;
  date: string;
  venue: string;
  opponent: string;
  batting?: { runs: number; balls: number; out: boolean };
  bowling?: { balls: number; runs: number; wickets: number };
}

export interface Career {
  /** Lower-cased name: how the same person is recognised across matches. */
  key: string;
  name: string;
  matches: number;
  batting: CareerBatting;
  bowling: CareerBowling;
  appearances: CareerAppearance[];
}

function emptyCareer(key: string, name: string): Career {
  return {
    key,
    name,
    matches: 0,
    batting: {
      innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0,
      notOuts: 0, best: 0, bestNotOut: false, fifties: 0, hundreds: 0,
    },
    bowling: {
      innings: 0, balls: 0, runs: 0, wickets: 0, maidens: 0,
      bestWickets: -1, bestRuns: 0,
    },
    appearances: [],
  };
}

export function careerKey(name: string): string {
  return name.trim().toLowerCase();
}

export function aggregateCareers(matches: readonly StoredMatch[]): Career[] {
  const careers = new Map<string, Career>();

  const get = (name: string): Career => {
    const key = careerKey(name);
    let c = careers.get(key);
    if (!c) {
      c = emptyCareer(key, name.trim());
      careers.set(key, c);
    }
    return c;
  };

  /** One appearance per innings slot, merging a match's batting with its bowling. */
  const slot = (c: Career, matchId: string, role: "batting" | "bowling") =>
    c.appearances.find((a) => a.matchId === matchId && !a[role]);

  for (const match of matches) {
    let game: MatchState;
    try {
      game = buildMatch(match.setup, match.rules, match.events);
    } catch {
      // A match the engine cannot fold is a bug, not a career. Skip it rather
      // than poison every total on the page.
      continue;
    }

    const seen = new Set<string>();
    const date = match.startedAt;
    const venue = match.venue;

    for (const { state } of game.innings) {
      for (const b of Object.values(state.batters)) {
        if (!b.batted) continue;
        const c = get(b.name);
        seen.add(c.key);

        c.batting.innings += 1;
        c.batting.runs += b.runs;
        c.batting.balls += b.balls;
        c.batting.fours += b.fours;
        c.batting.sixes += b.sixes;
        if (!b.out) c.batting.notOuts += 1;
        if (b.dismissal) {
          const ways = (c.batting.dismissals ??= {});
          ways[b.dismissal.kind] = (ways[b.dismissal.kind] ?? 0) + 1;
        }
        if (b.runs >= 100) c.batting.hundreds += 1;
        else if (b.runs >= 50) c.batting.fifties += 1;
        // A higher score wins; at equal scores the unbeaten one is the better.
        if (b.runs > c.batting.best || (b.runs === c.batting.best && !b.out)) {
          c.batting.best = b.runs;
          c.batting.bestNotOut = !b.out;
        }

        const batting = { runs: b.runs, balls: b.balls, out: b.out };
        const open = slot(c, match.id, "batting");
        if (open) open.batting = batting;
        else c.appearances.push({ matchId: match.id, date, venue, opponent: state.bowlingTeam, batting });
      }

      for (const o of Object.values(state.bowlers)) {
        if (o.balls === 0) continue;
        const c = get(o.name);
        seen.add(c.key);

        c.bowling.innings += 1;
        c.bowling.balls += o.balls;
        c.bowling.runs += o.runs;
        c.bowling.wickets += o.wickets;
        c.bowling.maidens += o.maidens;
        const better =
          o.wickets > c.bowling.bestWickets ||
          (o.wickets === c.bowling.bestWickets && o.runs < c.bowling.bestRuns);
        if (better) {
          c.bowling.bestWickets = o.wickets;
          c.bowling.bestRuns = o.runs;
        }

        const bowling = { balls: o.balls, runs: o.runs, wickets: o.wickets };
        const open = slot(c, match.id, "bowling");
        if (open) open.bowling = bowling;
        else c.appearances.push({ matchId: match.id, date, venue, opponent: state.battingTeam, bowling });
      }
    }

    for (const key of seen) {
      const c = careers.get(key);
      if (c) c.matches += 1;
    }
  }

  for (const c of careers.values()) {
    c.appearances.sort((a, b) => b.date.localeCompare(a.date));
  }

  return [...careers.values()].sort(
    (a, b) => b.batting.runs + b.bowling.wickets * 20 - (a.batting.runs + a.bowling.wickets * 20),
  );
}

/** Reads every match on this device. Browser only. */
export function loadCareers(): Career[] {
  const matches = listMatches()
    .map((m) => loadMatch(m.id))
    .filter((m): m is StoredMatch => m !== null);
  return aggregateCareers(matches);
}

export function battingAverage(b: CareerBatting): number | null {
  const dismissals = b.innings - b.notOuts;
  return dismissals > 0 ? b.runs / dismissals : null;
}

export function battingStrikeRate(b: CareerBatting): number {
  return b.balls > 0 ? (b.runs / b.balls) * 100 : 0;
}

export function bowlingAverage(b: CareerBowling): number | null {
  return b.wickets > 0 ? b.runs / b.wickets : null;
}

export function bowlingEconomy(b: CareerBowling): number {
  return b.balls > 0 ? (b.runs / b.balls) * 6 : 0;
}

export function bestBowlingLine(b: CareerBowling): string {
  return b.bestWickets < 0 ? "—" : `${b.bestWickets}/${b.bestRuns}`;
}

export function careerOvers(b: CareerBowling): string {
  return oversString(b.balls);
}

export interface CardFigures {
  main: { value: string; label: string };
  rows: readonly (readonly [string, string])[];
}

/** What a player card leads with: bowlers on wickets, everyone else on runs. */
export function cardFigures({ batting, bowling }: Pick<Career, "batting" | "bowling">): CardFigures {
  // The same weighting the players' list sorts by. Someone who has only bowled is
  // a bowler even before the first wicket, not a batter on nought.
  const onlyBowled = batting.innings === 0 && bowling.innings > 0;
  if (onlyBowled || bowling.wickets * 20 > batting.runs) {
    const average = bowlingAverage(bowling);
    return {
      main: { value: String(bowling.wickets), label: "wickets" },
      rows: [
        ["Average", average === null ? "—" : average.toFixed(2)],
        ["Economy", bowlingEconomy(bowling).toFixed(2)],
        ["Best", bestBowlingLine(bowling)],
        ["Overs", careerOvers(bowling)],
      ],
    };
  }
  const average = battingAverage(batting);
  return {
    main: { value: String(batting.runs), label: "runs" },
    rows: [
      ["Average", average === null ? "—" : average.toFixed(2)],
      ["Strike rate", batting.balls > 0 ? battingStrikeRate(batting).toFixed(1) : "—"],
      ["Best", batting.innings === 0 ? "—" : `${batting.best}${batting.bestNotOut ? "*" : ""}`],
      ["Sixes", String(batting.sixes)],
    ],
  };
}
