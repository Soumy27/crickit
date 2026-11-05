import "server-only";

import { db } from "./db";
import { listingStatus, type ListingStatus, type PublicPayload, type PublicSummary } from "./summary";

export interface PublicMatchView {
  code: string;
  battingTeam: string;
  bowlingTeam: string;
  venue: string;
  summary: PublicSummary;
  payload: PublicPayload;
  startedAt: string;
  updatedAt: string;
  status: ListingStatus;
  tournament: { code: string; name: string } | null;
}

export interface TournamentMatchRow {
  code: string;
  battingTeam: string;
  bowlingTeam: string;
  summary: PublicSummary;
  status: ListingStatus;
}

export interface TournamentView {
  code: string;
  name: string;
  city: string;
  startsOn: string | null;
  overs: number;
  teams: string[];
  matches: TournamentMatchRow[];
}

const iso = (value: unknown) => new Date(value as string).toISOString();

export async function getPublicMatch(code: string): Promise<PublicMatchView | null> {
  const sql = db();
  const rows = await sql`
    SELECT m.code, m.batting_team, m.bowling_team, m.venue, m.summary, m.payload, m.phase,
           m.started_at, m.updated_at, t.code AS t_code, t.name AS t_name
    FROM public_matches m LEFT JOIN tournaments t ON t.id = m.tournament_id
    WHERE m.code = ${code.toUpperCase()}`;
  const r = rows[0];
  if (!r) return null;
  const updatedAt = iso(r.updated_at);
  return {
    code: r.code as string,
    battingTeam: r.batting_team as string,
    bowlingTeam: r.bowling_team as string,
    venue: r.venue as string,
    summary: r.summary as PublicSummary,
    payload: r.payload as PublicPayload,
    startedAt: iso(r.started_at),
    updatedAt,
    status: listingStatus(r.phase as string, updatedAt),
    tournament: r.t_code ? { code: r.t_code as string, name: r.t_name as string } : null,
  };
}

export async function getTournament(code: string): Promise<TournamentView | null> {
  const sql = db();
  const rows = await sql`
    SELECT id, code, name, city, starts_on, overs, teams FROM tournaments
    WHERE code = ${code.toUpperCase()}`;
  const t = rows[0];
  if (!t) return null;
  const matches = await sql`
    SELECT code, batting_team, bowling_team, summary, phase, updated_at FROM public_matches
    WHERE tournament_id = ${t.id as string} ORDER BY started_at`;
  return {
    code: t.code as string,
    name: t.name as string,
    city: t.city as string,
    startsOn: t.starts_on ? iso(t.starts_on).slice(0, 10) : null,
    overs: t.overs as number,
    teams: t.teams as string[],
    matches: matches.map((m) => ({
      code: m.code as string,
      battingTeam: m.batting_team as string,
      bowlingTeam: m.bowling_team as string,
      summary: m.summary as PublicSummary,
      status: listingStatus(m.phase as string, iso(m.updated_at)),
    })),
  };
}
