/**
 * Search by name, near a place, or both.
 *
 * POST, because a location does not belong in a URL or a server log. It is used
 * for this one query and never stored.
 */

import { NextResponse } from "next/server";
import { db, failure, readJson } from "@/lib/public/db";
import { boundingBox, coarsePlace, distanceKm, NEARBY_KM, validPlace, type Place } from "@/lib/public/geo";
import { listingStatus, type ListingStatus, type PublicSummary } from "@/lib/public/summary";
import { cleanText, likePattern } from "@/lib/public/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 60;

export interface DiscoverMatch {
  code: string;
  battingTeam: string;
  bowlingTeam: string;
  venue: string;
  summary: PublicSummary;
  status: ListingStatus;
  distanceKm: number | null;
}

export interface DiscoverTournament {
  code: string;
  name: string;
  city: string;
  startsOn: string | null;
  teamCount: number;
  distanceKm: number | null;
}

function within(place: Place | null, lat: unknown, lng: unknown): number | null {
  if (!place || typeof lat !== "number" || typeof lng !== "number") return null;
  return distanceKm(place, { lat, lng });
}

export async function POST(request: Request) {
  try {
    const body = await readJson<{ q?: string; lat?: number; lng?: number }>(request);
    const q = cleanText(body.q, 80);
    const pattern = q ? likePattern(q) : null;
    const exact = q.toUpperCase();
    const given = validPlace(body.lat, body.lng);
    const place = given ? coarsePlace(given) : null;
    const box = place ? boundingBox(place, NEARBY_KM) : null;
    const sql = db();

    const [matchRows, tournamentRows] = await Promise.all([
      sql`
        SELECT code, batting_team, bowling_team, venue, lat, lng, phase, summary, updated_at
        FROM public_matches
        WHERE (${pattern}::text IS NULL
               OR (batting_team || ' ' || bowling_team || ' ' || venue) ILIKE ${pattern}
               OR code = ${exact})
          AND (${box?.minLat ?? null}::float8 IS NULL OR (
               lat BETWEEN ${box?.minLat ?? null}::float8 AND ${box?.maxLat ?? null}::float8
               AND lng BETWEEN ${box?.minLng ?? null}::float8 AND ${box?.maxLng ?? null}::float8))
        ORDER BY updated_at DESC LIMIT ${LIMIT}`,
      sql`
        SELECT code, name, city, lat, lng, starts_on, jsonb_array_length(teams) AS team_count
        FROM tournaments
        WHERE (${pattern}::text IS NULL
               OR (name || ' ' || city) ILIKE ${pattern}
               OR code = ${exact})
          AND (${box?.minLat ?? null}::float8 IS NULL OR (
               lat BETWEEN ${box?.minLat ?? null}::float8 AND ${box?.maxLat ?? null}::float8
               AND lng BETWEEN ${box?.minLng ?? null}::float8 AND ${box?.maxLng ?? null}::float8))
        ORDER BY created_at DESC LIMIT ${LIMIT}`,
    ]);

    const rank: Record<ListingStatus, number> = { live: 0, paused: 1, finished: 2 };
    const matches: DiscoverMatch[] = matchRows
      .map((m) => ({
        code: m.code as string,
        battingTeam: m.batting_team as string,
        bowlingTeam: m.bowling_team as string,
        venue: m.venue as string,
        summary: m.summary as PublicSummary,
        status: listingStatus(m.phase as string, new Date(m.updated_at as string).toISOString()),
        distanceKm: within(place, m.lat, m.lng),
      }))
      // The box has corners; the radius does not.
      .filter((m) => !place || (m.distanceKm !== null && m.distanceKm <= NEARBY_KM))
      .sort((a, b) => rank[a.status] - rank[b.status] || (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    const tournaments: DiscoverTournament[] = tournamentRows
      .map((t) => ({
        code: t.code as string,
        name: t.name as string,
        city: t.city as string,
        startsOn: t.starts_on ? new Date(t.starts_on as string).toISOString().slice(0, 10) : null,
        teamCount: t.team_count as number,
        distanceKm: within(place, t.lat, t.lng),
      }))
      .filter((t) => !place || (t.distanceKm !== null && t.distanceKm <= NEARBY_KM))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    return NextResponse.json({ matches, tournaments });
  } catch (err) {
    return failure(err);
  }
}
