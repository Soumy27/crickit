/**
 * Short, plain descriptions of a delivery, for confirmation UI.
 *
 * Deliberately not the commentary: the scorer is checking that the right thing
 * was recorded, so this says what went in the book, not what it sounded like.
 */

import type { BallEvent } from "./types";

const DISMISSAL: Record<string, string> = {
  bowled: "Bowled",
  caught: "Caught",
  lbw: "LBW",
  run_out: "Run out",
  stumped: "Stumped",
  hit_wicket: "Hit wicket",
};

/** Optional labels, so the chip can follow the app's language. English otherwise. */
export interface BallWords {
  four: string; six: string; dotBall: string; run: string; runs: string; wide: string; noBall: string;
  bye: string; legBye: string; out: string; dismissals: Record<string, string>;
}

export function describeBall(ev: BallEvent, batterName?: string, w?: BallWords): string {
  const who = batterName ? ` — ${batterName}` : "";

  if (w) {
    if (ev.wicket) return `${w.dismissals[ev.wicket.kind] ?? w.out}${who}`;
    if (ev.extra === "wide") return ev.extraRuns > 0 ? `${w.wide}, ${ev.extraRuns}` : w.wide;
    if (ev.extra === "noball") return ev.batRuns > 0 ? `${w.noBall}, ${ev.batRuns}` : w.noBall;
    if (ev.extra === "bye") return `${w.bye} ${ev.extraRuns}`;
    if (ev.extra === "legbye") return `${w.legBye} ${ev.extraRuns}`;
    if (ev.batRuns === 0) return `${w.dotBall}${who}`;
    if (ev.batRuns === 4) return `${w.four}${who}`;
    if (ev.batRuns === 6) return `${w.six}${who}`;
    return `${ev.batRuns} ${(ev.batRuns === 1 ? w.run : w.runs).toLowerCase()}${who}`;
  }

  if (ev.wicket) {
    const how = DISMISSAL[ev.wicket.kind] ?? "Out";
    const end = ev.wicket.who === "non_striker" ? " (non-striker)" : "";
    return `${how}${who}${end}`;
  }

  if (ev.extra === "wide") {
    return ev.extraRuns > 0 ? `Wide, ${ev.extraRuns} run${ev.extraRuns > 1 ? "s" : ""}` : "Wide";
  }
  if (ev.extra === "noball") {
    return ev.batRuns > 0 ? `No ball, ${ev.batRuns} off the bat` : "No ball";
  }
  if (ev.extra === "bye") {
    return `${ev.extraRuns} bye${ev.extraRuns > 1 ? "s" : ""}`;
  }
  if (ev.extra === "legbye") {
    return `${ev.extraRuns} leg bye${ev.extraRuns > 1 ? "s" : ""}`;
  }

  if (ev.batRuns === 0) return `Dot ball${who}`;
  if (ev.batRuns === 4) return `Four${who}`;
  if (ev.batRuns === 6) return `Six${who}`;
  return `${ev.batRuns} run${ev.batRuns > 1 ? "s" : ""}${who}`;
}
