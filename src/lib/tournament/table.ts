/**
 * Fixtures and the points table for a limited-overs tournament.
 *
 * Two points for a win, one each for a tie or no result. Net run rate follows
 * the standard rule: a side bowled out counts its full quota of overs, because
 * being dismissed early must not flatter the rate. When rain ends a chase and
 * DLS decides it, Team 1 is credited with Team 2's par off the overs Team 2 faced.
 * Taken from the ICC's playing conditions as published for its 2013 Champions
 * Trophy; a tournament's own conditions may differ.
 */

import type { InningsSummary, PublicSummary } from "../public/summary";

export interface Fixture {
  home: string;
  away: string;
}

/** Round robin by the circle method: every pair once, evenly spread over rounds. */
export function roundRobin(teams: readonly string[]): Fixture[][] {
  const seats: (string | null)[] = [...teams];
  if (seats.length % 2 === 1) seats.push(null);
  const rounds: Fixture[][] = [];
  for (let round = 0; round < seats.length - 1; round++) {
    const games: Fixture[] = [];
    for (let i = 0; i < seats.length / 2; i++) {
      const home = seats[i];
      const away = seats[seats.length - 1 - i];
      if (home && away) games.push({ home, away });
    }
    rounds.push(games);
    seats.splice(1, 0, seats.pop() as string | null);
  }
  return rounds;
}

export interface TableRow {
  team: string;
  played: number;
  won: number;
  lost: number;
  noResult: number;
  points: number;
  runsFor: number;
  ballsFor: number;
  runsAgainst: number;
  ballsAgainst: number;
  /** Null until the side has both batted and bowled in a decided match. */
  nrr: number | null;
}

function ballsForRate(innings: InningsSummary): number {
  const allOut = innings.wickets >= innings.maxWickets;
  return allOut && innings.maxOvers !== null ? innings.maxOvers * 6 : innings.balls;
}

export function pointsTable(teams: readonly string[], matches: readonly PublicSummary[]): TableRow[] {
  const rows = new Map<string, TableRow>(
    teams.map((team) => [
      team,
      {
        team, played: 0, won: 0, lost: 0, noResult: 0, points: 0,
        runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0, nrr: null,
      },
    ]),
  );

  for (const { phase, result, innings, rainPar } of matches) {
    if (phase !== "finished" || !result || innings.length === 0) continue;
    const sides = [innings[0].team, innings[0].opponent].map((t) => rows.get(t));
    if (!sides[0] || !sides[1]) continue;
    const [a, b] = sides as [TableRow, TableRow];
    a.played += 1;
    b.played += 1;

    if (result.winner && (result.kind === "runs" || result.kind === "wickets" || result.kind === "innings")) {
      const winner = rows.get(result.winner);
      const loser = winner === a ? b : a;
      if (winner) {
        winner.won += 1;
        winner.points += 2;
        loser.lost += 1;
      }
    } else if (result.kind === "tie") {
      a.points += 1;
      b.points += 1;
    } else {
      a.noResult += 1;
      b.noResult += 1;
      a.points += 1;
      b.points += 1;
      // An abandoned match does not touch either side's rate.
      continue;
    }

    innings.forEach((i, index) => {
      const batting = rows.get(i.team);
      const bowling = rows.get(i.opponent);
      if (!batting || !bowling) return;
      const chase = innings[1];
      // Rain ended the chase: Team 1 is credited with par, off the overs Team 2 faced.
      const onPar = index === 0 && rainPar !== undefined && chase;
      const runs = onPar ? rainPar : i.runs;
      const balls = onPar ? chase.balls : ballsForRate(i);
      batting.runsFor += runs;
      batting.ballsFor += balls;
      bowling.runsAgainst += runs;
      bowling.ballsAgainst += balls;
    });
  }

  for (const row of rows.values()) {
    if (row.ballsFor > 0 && row.ballsAgainst > 0) {
      row.nrr = (row.runsFor * 6) / row.ballsFor - (row.runsAgainst * 6) / row.ballsAgainst;
    }
  }

  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      (y.nrr ?? -Infinity) - (x.nrr ?? -Infinity) ||
      x.team.localeCompare(y.team),
  );
}

export function formatNrr(nrr: number | null): string {
  if (nrr === null) return "—";
  return `${nrr >= 0 ? "+" : ""}${nrr.toFixed(3)}`;
}
