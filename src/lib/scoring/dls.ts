/**
 * Rain rules: the Duckworth-Lewis Standard Edition, as the ICC publishes it.
 *
 * International matches run the licensed Stern edition software, whose numbers
 * are not public. The Standard Edition is the ICC's own stated fallback when that
 * software is unavailable, and the only version anyone can check by hand, so it
 * is what a club scorer can defend at a ground. It assumes eleven-a-side.
 *
 * Everything is in tenths of a percent, so targets are exact integer arithmetic
 * and never one run out through floating-point rounding.
 */

import { RESOURCES } from "./dls-table";

/** A stoppage: balls left when play stopped and when it resumed, wickets down. */
export interface Suspension {
  ballsBefore: number;
  ballsAfter: number;
  wickets: number;
}

/**
 * Average first-innings 50-over total. The ICC sets 245 for full members and
 * recommends 200 for lower levels, which is the nearest guidance for club cricket.
 */
export const G50_CLUB = 200;
export const G50_INTERNATIONAL = 245;
export const MAX_DLS_OVERS = 50;

/** Tenths of a percent remaining. Ten wickets down leaves nothing. */
export function resourcesLeft(ballsLeft: number, wicketsLost: number): number {
  if (wicketsLost >= 10) return 0;
  const balls = Math.max(0, Math.min(RESOURCES.length - 1, ballsLeft));
  return RESOURCES[balls][Math.max(0, wicketsLost)];
}

export function resourceLost(s: Suspension): number {
  return resourcesLeft(s.ballsBefore, s.wickets) - resourcesLeft(s.ballsAfter, s.wickets);
}

/** R1 or R2: what the innings started with, less everything rain took. */
export function inningsResources(startOvers: number, suspensions: readonly Suspension[]): number {
  return suspensions.reduce((r, s) => r - resourceLost(s), resourcesLeft(startOvers * 6, 0));
}

/**
 * The par score: Team 1's total adjusted for resources, figures after the decimal
 * point ignored. The target is one more, and one short of the target is a tie.
 */
export function parScore(s: number, r1: number, r2: number, g50 = G50_CLUB): number {
  if (r1 <= 0) return s;
  if (r2 <= r1) return Math.floor((s * r2) / r1);
  // More resources than Team 1 had: the extra is valued in average runs, not by ratio.
  return s + Math.floor((g50 * (r2 - r1)) / 1000);
}

export function reviseTarget(s: number, r1: number, r2: number, g50 = G50_CLUB): number {
  return parScore(s, r1, r2, g50) + 1;
}

/**
 * How many overs Team 2 must face for a result to stand. The ICC sets 20 in a
 * 50-over match and 5 in a Twenty20; other lengths are scaled between the two.
 */
export function minimumOvers(matchOvers: number): number {
  if (matchOvers >= 50) return 20;
  if (matchOvers > 20) return Math.ceil(matchOvers * 0.4);
  return Math.min(5, Math.ceil(matchOvers / 2));
}
