/**
 * Turns one spoken utterance into one delivery.
 *
 * Two layers, and this one is the fast layer: a deterministic lexicon match
 * that resolves the formulaic ~90% of utterances instantly and offline. What
 * it cannot resolve confidently is handed to the LLM fallback instead, so a
 * scorer never waits on a network round trip to record a dot ball.
 *
 * Nothing here commits a delivery on its own. The caller shows the result for
 * confirmation, because a misheard ball that nobody noticed is the one failure
 * this product cannot have.
 */

import type { BallEvent, DismissalKind, ExtraKind, Player } from "../scoring/types";
import {
  EXTRA_TERMS,
  GENERIC_WICKET,
  RUN_TERMS,
  WICKET_TERMS,
  type Term,
  NEGATIVES,
  RUN_WORDS,
} from "./lexicon";

export interface ParseContext {
  /** Squad names, so "Rohit ne chauka mara" can be attributed. */
  players?: readonly Player[];
}

export type ParseOutcome =
  | {
      status: "parsed";
      event: BallEvent;
      /** 0–1. Below CONFIRM_THRESHOLD the UI should hold it open longer. */
      confidence: number;
      /** The phrases that matched, for the audit trail and for debugging. */
      matched: string[];
      /** Named in the utterance and found in the squad. */
      player?: Player;
    }
  | {
      status: "needs_detail";
      /** What the app must ask before this delivery can be recorded. */
      question: "which_dismissal";
      partial: BallEvent;
      matched: string[];
    }
  | { status: "unparsed"; transcript: string };

/** Below this, show the chip for longer and do not auto-commit. */
export const CONFIRM_THRESHOLD = 0.7;

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

export function normalise(raw: string): string {
  // NFC, and no joiners: the same Kannada or Bengali word arrives with or
  // without them depending on who typed it.
  let s = raw.normalize("NFC").replace(/[\u200c\u200d]/g, "").toLowerCase();
  // Devanagari digits to Latin, so "४" and "4" are the same token.
  s = s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  // Keep letters, digits, spaces — and combining marks, which is the whole
  // ball game in Devanagari: the vowel signs in "चौका" are marks, not letters,
  // so stripping them leaves "च क" and nothing matches.
  s = s.replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Word-boundary match that also works either side of Devanagari. */
function says(haystack: string, needle: string): boolean {
  const i = haystack.indexOf(needle);
  if (i === -1) return false;
  const before = haystack[i - 1];
  const after = haystack[i + needle.length];
  const isWordish = (c: string | undefined) =>
    c !== undefined && /[\p{L}\p{N}\p{M}]/u.test(c);
  return !isWordish(before) && !isWordish(after);
}

/** First term whose longest phrasing appears. Terms are ordered by priority. */
function findTerm(text: string, terms: readonly Term[]): { value: string; phrase: string } | null {
  for (const term of terms) {
    const ordered = [...term.says].sort((a, b) => b.length - a.length);
    for (const phrase of ordered) {
      if (says(text, normalise(phrase))) return { value: term.value, phrase };
    }
  }
  return null;
}

/** A bare digit, for when Prisma's `transcribe` format writes numbers. */
function findBareNumber(text: string): { value: number; phrase: string } | null {
  const m = text.match(/(?:^|\s)([0-6])(?:\s|$)/);
  return m ? { value: Number(m[1]), phrase: m[1] } : null;
}

function findPlayer(text: string, players: readonly Player[] | undefined): Player | undefined {
  if (!players?.length) return undefined;
  // Longest spelling wins, so "Omkar" does not shadow "Omkar Patil".
  let best: { player: Player; len: number } | undefined;
  for (const p of players) {
    for (const spelling of [p.name, ...(p.aliases ?? [])]) {
      const needle = normalise(spelling);
      if (needle && says(text, needle) && (!best || needle.length > best.len)) {
        best = { player: p, len: needle.length };
      }
    }
  }
  return best?.player;
}

export function parseBall(transcript: string, ctx: ParseContext = {}): ParseOutcome {
  const text = normalise(transcript);
  if (!text) return { status: "unparsed", transcript };

  const matched: string[] = [];
  const player = findPlayer(text, ctx.players);
  if (player) matched.push(player.name);

  const extraHit = findTerm(text, EXTRA_TERMS);
  if (extraHit) matched.push(extraHit.phrase);

  const wicketHit = findTerm(text, WICKET_TERMS);
  if (wicketHit) matched.push(wicketHit.phrase);

  const genericWicket =
    !wicketHit && GENERIC_WICKET.some((w) => says(text, normalise(w)));

  // A run word, or a bare digit if Prisma wrote one. A negative beats both.
  const noRun = !extraHit && !wicketHit && !genericWicket && saysNoRun(text);
  const runHit = noRun ? null : findTerm(text, RUN_TERMS);
  const bareNumber = runHit || noRun ? null : findBareNumber(text);
  const runPhrase = noRun ? "no run" : (runHit?.phrase ?? bareNumber?.phrase);
  if (runPhrase) matched.push(runPhrase);
  const runs = noRun ? 0 : runHit ? Number(runHit.value) : (bareNumber?.value ?? null);

  const extra = extraHit?.value as ExtraKind | undefined;

  // Nothing recognised at all.
  if (!extra && !wicketHit && !genericWicket && runs === null) {
    return { status: "unparsed", transcript };
  }

  // Runs ride differently depending on the extra. On a wide, bye or leg bye
  // they are run, not hit; on a no-ball or a normal ball they come off the bat.
  let batRuns = 0;
  let extraRuns = 0;
  if (extra === "wide" || extra === "bye" || extra === "legbye") {
    extraRuns = runs ?? (extra === "wide" ? 0 : 1);
  } else if (runs !== null) {
    batRuns = runs;
  }

  const event: BallEvent = {
    type: "ball",
    batRuns,
    extraRuns,
    said: transcript,
  };
  if (extra) event.extra = extra;

  if (wicketHit) {
    const kind = wicketHit.value as DismissalKind;
    event.wicket = {
      kind,
      // Only a run out can take the non-striker, and the scorer has to say so.
      who: kind === "run_out" && says(text, "non striker") ? "non_striker" : "striker",
    };
  } else if (genericWicket) {
    // We heard a wicket but not how. Guessing here would be the worst option.
    return {
      status: "needs_detail",
      question: "which_dismissal",
      partial: event,
      matched,
    };
  }

  return {
    status: "parsed",
    event,
    confidence: score({ extra, wicket: Boolean(wicketHit), runs, text, matched }),
    matched,
    player,
  };
}

/**
 * A negative with a word for a run in any script, or a negative in something so
 * short it can only be about this ball ("chauka nahi", "पరుగులు लेवू").
 */
function saysNoRun(text: string): boolean {
  if (!NEGATIVES.some((n) => says(text, normalise(n)))) return false;
  return RUN_WORDS.some((w) => text.includes(normalise(w))) || text.split(" ").length <= 3;
}

function score(a: {
  extra?: ExtraKind;
  wicket: boolean;
  runs: number | null;
  text: string;
  matched: string[];
}): number {
  let c = 0.5;
  // An explicit run word is the strongest single signal.
  if (a.runs !== null) c += 0.3;
  if (a.extra) c += 0.15;
  if (a.wicket) c += 0.15;
  // A long utterance with one match in it is more likely to be a mishearing.
  const words = a.text.split(" ").length;
  if (words > 8 && a.matched.length <= 1) c -= 0.25;
  return Math.max(0, Math.min(1, c));
}
