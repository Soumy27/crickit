/**
 * Plain-language reading of a player's record, worked out from their matches.
 *
 * Nothing here predicts anything or claims more than the sample holds. Below a
 * few innings it says so and stays quiet, because "averages 60" off two knocks
 * is a nice thing to read and not a true thing to know.
 */

import type { DismissalKind } from "../scoring/types";
import type { Career } from "./careers";

const MIN_INNINGS = 3;

const DISMISSAL_WORDS: Record<DismissalKind, string> = {
  bowled: "bowled",
  caught: "caught",
  lbw: "lbw",
  run_out: "run out",
  stumped: "stumped",
  hit_wicket: "hit wicket",
};

export interface Insights {
  /** Most recent last, so it reads left to right as time does. */
  battingForm: string[];
  bowlingForm: string[];
  notes: string[];
  /** Too few matches to say anything worth trusting. */
  thin: boolean;
}

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export function careerInsights(career: Career): Insights {
  const { batting, bowling, appearances } = career;
  // Appearances are sorted newest first.
  const batted = appearances.flatMap((a) => (a.batting ? [a.batting] : []));
  const bowled = appearances.flatMap((a) => (a.bowling ? [a.bowling] : []));
  const notes: string[] = [];

  if (batted.length >= MIN_INNINGS) {
    if (batted.length >= 6) {
      const recent = mean(batted.slice(0, 3).map((b) => b.runs));
      const earlier = mean(batted.slice(3).map((b) => b.runs));
      if (recent >= earlier * 1.25) {
        notes.push(`In form: ${recent.toFixed(0)} runs an innings over the last three, up from ${earlier.toFixed(0)} before that.`);
      } else if (recent <= earlier * 0.75) {
        notes.push(`A quiet patch: ${recent.toFixed(0)} runs an innings over the last three, down from ${earlier.toFixed(0)} before that.`);
      }
    }

    if (batting.runs > 0) {
      const share = ((batting.fours * 4 + batting.sixes * 6) / batting.runs) * 100;
      notes.push(`${share.toFixed(0)}% of their runs come in boundaries.`);
    }

    const dismissals = batting.innings - batting.notOuts;
    if (dismissals > 0) {
      notes.push(`Faces ${(batting.balls / dismissals).toFixed(0)} balls for each dismissal.`);
    }

    const ways = Object.entries(batting.dismissals ?? {}) as [DismissalKind, number][];
    const [kind, count] = ways.sort((a, b) => b[1] - a[1])[0] ?? [];
    if (kind && count && dismissals >= MIN_INNINGS) {
      notes.push(`Most often out ${DISMISSAL_WORDS[kind]}: ${count} of ${dismissals} dismissals.`);
    }

    const starts = batted.filter((b) => b.runs >= 20);
    if (starts.length >= MIN_INNINGS) {
      const converted = starts.filter((b) => b.runs >= 50).length;
      notes.push(`Turned ${converted} of ${starts.length} starts of 20 or more into fifties.`);
    }
  }

  if (bowled.length >= MIN_INNINGS && bowling.balls > 0) {
    if (bowling.wickets > 0) {
      notes.push(`Takes a wicket every ${(bowling.balls / bowling.wickets).toFixed(0)} balls.`);
    }
    notes.push(`Takes ${(bowling.wickets / bowling.innings).toFixed(1)} wickets a match when bowling.`);
  }

  return {
    battingForm: batted
      .slice(0, 5)
      .reverse()
      .map((b) => `${b.runs}${b.out ? "" : "*"}`),
    bowlingForm: bowled
      .slice(0, 5)
      .reverse()
      .map((b) => `${b.wickets}/${b.runs}`),
    notes,
    thin: batted.length < MIN_INNINGS && bowled.length < MIN_INNINGS,
  };
}
