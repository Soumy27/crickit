/**
 * Everything arriving at the public API is untrusted: there is no login, so the
 * only thing standing between a stranger and the search page is this file.
 */

import type { MatchRules } from "../scoring/match";
import type { InningsSetup, MatchEvent, Player } from "../scoring/types";
import { summarize, type PublicPayload, type PublicSummary } from "./summary";

const MAX_TEAM = 60;
const MAX_NAME = 60;
const MAX_VENUE = 80;
const MAX_PLAYERS = 40;
const MAX_EVENTS = 8000;

export class Invalid extends Error {}

/** Trimmed, control characters out, runs of spaces closed up. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanPlayers(value: unknown): Player[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_PLAYERS) {
    throw new Invalid("Each squad needs between 2 and 40 players.");
  }
  return value.map((raw: Partial<Player>) => {
    const name = cleanText(raw?.name, MAX_NAME);
    const id = cleanText(raw?.id, 20);
    if (!name || !id) throw new Invalid("Every player needs a name.");
    return { id, name };
  });
}

/** The raw call stays on the scorer's phone: nobody signed up to publish what they shouted. */
function cleanEvents(value: unknown): MatchEvent[] {
  if (!Array.isArray(value) || value.length > MAX_EVENTS) throw new Invalid("Bad event log.");
  return value.map((event: MatchEvent) => {
    if (event?.type !== "ball") return event;
    const ball = { ...event };
    delete ball.said;
    return ball;
  });
}

export function cleanPayload(body: Partial<PublicPayload> | null | undefined): {
  payload: PublicPayload;
  summary: PublicSummary;
} {
  const raw = body?.setup;
  const battingTeam = cleanText(raw?.battingTeam, MAX_TEAM);
  const bowlingTeam = cleanText(raw?.bowlingTeam, MAX_TEAM);
  if (!battingTeam || !bowlingTeam) throw new Invalid("A listed match needs two teams.");

  const setup: InningsSetup = {
    battingTeam,
    bowlingTeam,
    batting: cleanPlayers(raw?.batting),
    bowling: cleanPlayers(raw?.bowling),
    strikerId: cleanText(raw?.strikerId, 20),
    nonStrikerId: cleanText(raw?.nonStrikerId, 20),
    bowlerId: cleanText(raw?.bowlerId, 20),
    maxOvers: typeof raw?.maxOvers === "number" ? raw.maxOvers : null,
  };
  const rules: MatchRules | undefined = body?.rules;
  const payload: PublicPayload = { setup, rules, events: cleanEvents(body?.events) };

  try {
    // The engine is the validator: a log it cannot fold is not a match.
    return { payload, summary: summarize(payload) };
  } catch (err) {
    throw new Invalid(`That match could not be read: ${(err as Error).message}`);
  }
}

export function cleanVenue(value: unknown): string {
  return cleanText(value, MAX_VENUE) || "Local ground";
}

/** ILIKE treats % and _ as wildcards; a search for "100%" should mean 100%. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
