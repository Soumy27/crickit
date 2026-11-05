/**
 * Match storage.
 *
 * The browser is the source of truth during a match. Maidans have bad network,
 * and a scorecard that stalls because a request is in flight is worse than no
 * app at all — so every delivery lands in local storage first and syncs later.
 *
 * What is stored is the event log, not the derived state. Replaying the log is
 * cheap (a few hundred events), and it means a fix to the engine corrects
 * every match already recorded rather than only the next one.
 */

import type { MatchRules } from "../scoring/match";
import type { InningsSetup, MatchEvent } from "../scoring/types";

const KEY_PREFIX = "bks.match.";
const INDEX_KEY = "bks.matches";

export interface StoredMatch {
  id: string;
  /** Short code for the shareable link: crickit.app/m/XK24. */
  code: string;
  venue: string;
  startedAt: string;
  language: string;
  /** Absent on matches saved before formats existed: those read as limited overs. */
  rules?: MatchRules;
  /** The first innings. The rest are worked out from it and the event log. */
  setup: InningsSetup;
  events: MatchEvent[];
  /** Present only once the scorer has chosen to make this match public. */
  listing?: MatchListing;
}

/**
 * The opt-in, and the means to keep it up to date. `code` and `token` arrive when
 * the server has it, which may be a while after `wanted` if the ground has no signal.
 */
export interface MatchListing {
  wanted: boolean;
  lat?: number;
  lng?: number;
  tournament?: { code: string; key: string };
  code?: string;
  /** Only this device can update or remove the listing. */
  token?: string;
}

export interface MatchSummary {
  id: string;
  code: string;
  venue: string;
  startedAt: string;
  battingTeam: string;
  bowlingTeam: string;
}

/** Unambiguous out loud and on a scrap of paper: no O/0, no I/1. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode(length = 4): string {
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

function available(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    // Private mode, or storage blocked. The match still runs in memory.
    return false;
  }
}

export function saveMatch(match: StoredMatch): void {
  if (!available()) return;
  try {
    localStorage.setItem(KEY_PREFIX + match.id, JSON.stringify(match));
    const index = listMatches().filter((m) => m.id !== match.id);
    index.unshift({
      id: match.id,
      code: match.code,
      venue: match.venue,
      startedAt: match.startedAt,
      battingTeam: match.setup.battingTeam,
      bowlingTeam: match.setup.bowlingTeam,
    });
    localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, 50)));
  } catch {
    // Quota, or storage cleared mid-match. Losing the write must not throw
    // into the scoring path; the in-memory state is still correct.
  }
}

export function loadMatch(id: string): StoredMatch | null {
  if (!available()) return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as StoredMatch) : null;
  } catch {
    return null;
  }
}

export function listMatches(): MatchSummary[] {
  if (!available()) return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as MatchSummary[]) : [];
  } catch {
    return [];
  }
}
