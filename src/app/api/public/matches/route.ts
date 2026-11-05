/**
 * Makes a match public. Only ever called after the scorer has opted in, and the
 * score it stores is worked out from the balls here rather than taken on trust.
 */

import { NextResponse } from "next/server";
import { creatorHash, db, failure, newSecret, publicCode, readJson, secretMatches } from "@/lib/public/db";
import { coarsePlace, validPlace } from "@/lib/public/geo";
import type { PublicPayload } from "@/lib/public/summary";
import { cleanPayload, cleanVenue, Invalid } from "@/lib/public/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREATES_PER_HOUR = 40;

interface Body extends Partial<PublicPayload> {
  venue?: string;
  startedAt?: string;
  lat?: number;
  lng?: number;
  tournament?: { code?: string; key?: string };
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const { payload, summary } = cleanPayload(body);
    const place = validPlace(body.lat, body.lng);
    const { lat = null, lng = null } = place ? coarsePlace(place) : {};
    const creator = creatorHash(request);
    const sql = db();

    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM public_matches
      WHERE creator_hash = ${creator} AND updated_at > now() - interval '1 hour'`;
    if ((count as number) >= CREATES_PER_HOUR) {
      return NextResponse.json({ error: "Too many public matches at once. Try again later." }, { status: 429 });
    }

    let tournamentId: string | null = null;
    if (body.tournament?.code) {
      const [t] = await sql`
        SELECT id, key_hash, teams FROM tournaments WHERE code = ${body.tournament.code.toUpperCase()}`;
      if (!t || !secretMatches(body.tournament.key ?? "", t.key_hash as string)) {
        return NextResponse.json({ error: "That scorer link is not valid for this tournament." }, { status: 403 });
      }
      const teams = t.teams as string[];
      if (!teams.includes(payload.setup.battingTeam) || !teams.includes(payload.setup.bowlingTeam)) {
        throw new Invalid("Both teams must be in the tournament.");
      }
      tournamentId = t.id as string;
    }

    const started = new Date(body.startedAt ?? "");
    const startedAt = Number.isNaN(started.getTime()) ? new Date().toISOString() : started.toISOString();
    const { secret, hash } = newSecret();

    // A collision on six characters is unlikely, not impossible.
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = publicCode();
      const rows = await sql`
        INSERT INTO public_matches
          (code, token_hash, creator_hash, tournament_id, batting_team, bowling_team, venue,
           lat, lng, phase, summary, payload, started_at)
        VALUES
          (${code}, ${hash}, ${creator}, ${tournamentId}, ${payload.setup.battingTeam},
           ${payload.setup.bowlingTeam}, ${cleanVenue(body.venue)}, ${lat}, ${lng}, ${summary.phase},
           ${JSON.stringify(summary)}::jsonb, ${JSON.stringify(payload)}::jsonb, ${startedAt})
        ON CONFLICT (code) DO NOTHING
        RETURNING code`;
      if (rows[0]) return NextResponse.json({ code, token: secret }, { status: 201 });
    }
    throw new Error("Could not find a free code.");
  } catch (err) {
    return failure(err);
  }
}
