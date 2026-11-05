/**
 * What a listed match says about itself in search and on the points table.
 *
 * Always worked out from the event log on the server, never taken from the
 * client, so a listing cannot claim a score its own balls do not add up to.
 */

import { buildMatch, type MatchPhase, type MatchResult, type MatchRules } from "../scoring/match";
import type { InningsSetup, MatchEvent } from "../scoring/types";

export interface InningsSummary {
  team: string;
  opponent: string;
  runs: number;
  wickets: number;
  balls: number;
  /** Null for a timed innings. Rain-revised if rain cut it. */
  maxOvers: number | null;
  maxWickets: number;
}

export interface PublicSummary {
  phase: MatchPhase;
  innings: InningsSummary[];
  result: MatchResult | null;
  /**
   * Team 2's par score, when rain ended the chase and DLS decided it. Net run
   * rate credits it to Team 1 in place of the runs they actually made.
   */
  rainPar?: number;
}

export interface PublicPayload {
  setup: InningsSetup;
  rules?: MatchRules;
  events: MatchEvent[];
}

export type ListingStatus = "live" | "paused" | "finished";

/** A scorer who has said nothing for this long has probably gone home. */
const QUIET_MS = 6 * 60 * 60 * 1000;

export function summarize({ setup, rules, events }: PublicPayload): PublicSummary {
  const game = buildMatch(setup, rules, events);
  const { result } = game;
  const last = events[events.length - 1];
  const chase = game.innings[1]?.state;
  let rainPar: number | undefined;
  // The engine settles a rain result against par, so the margin gives par back.
  if (last?.type === "end_match" && last.outcome === "rain" && result?.dls && chase) {
    rainPar = result.winner === chase.battingTeam ? chase.runs - result.margin : chase.runs + result.margin;
  }
  return {
    phase: game.phase,
    result,
    ...(rainPar === undefined ? {} : { rainPar }),
    innings: game.innings.map(({ state }) => ({
      team: state.battingTeam,
      opponent: state.bowlingTeam,
      runs: state.runs,
      wickets: state.wickets,
      balls: state.legalBalls,
      maxOvers: state.maxOvers,
      maxWickets: state.maxWickets,
    })),
  };
}

export function listingStatus(phase: string, updatedAt: string, now = Date.now()): ListingStatus {
  if (phase === "finished") return "finished";
  return now - new Date(updatedAt).getTime() > QUIET_MS ? "paused" : "live";
}
