import { NextResponse } from "next/server";
import { creatorHash, db, failure, newSecret, publicCode, readJson } from "@/lib/public/db";
import { coarsePlace, validPlace } from "@/lib/public/geo";
import { cleanText, Invalid } from "@/lib/public/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREATES_PER_HOUR = 10;
const MAX_TEAMS = 24;

interface Body {
  name?: string;
  city?: string;
  overs?: number;
  teams?: unknown;
  startsOn?: string;
  lat?: number;
  lng?: number;
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const name = cleanText(body.name, 80);
    const city = cleanText(body.city, 60);
    if (name.length < 3) throw new Invalid("Give the tournament a name.");
    if (city.length < 2) throw new Invalid("Say which town or city it is in, so people can find it.");

    const overs = Number(body.overs);
    if (!Number.isInteger(overs) || overs < 1 || overs > 50) {
      throw new Invalid("Overs must be a whole number from 1 to 50.");
    }

    const raw = Array.isArray(body.teams) ? body.teams : [];
    const teams = raw.map((t) => cleanText(t, 60)).filter(Boolean);
    const unique = new Set(teams.map((t) => t.toLowerCase()));
    if (teams.length < 2) throw new Invalid("A tournament needs at least two teams.");
    if (teams.length > MAX_TEAMS) throw new Invalid(`A tournament can have up to ${MAX_TEAMS} teams.`);
    if (unique.size !== teams.length) throw new Invalid("Two teams have the same name.");

    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.startsOn ?? "") ? (body.startsOn as string) : null;
    const place = validPlace(body.lat, body.lng);
    const { lat = null, lng = null } = place ? coarsePlace(place) : {};
    const creator = creatorHash(request);
    const sql = db();

    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM tournaments
      WHERE creator_hash = ${creator} AND created_at > now() - interval '1 hour'`;
    if ((count as number) >= CREATES_PER_HOUR) {
      return NextResponse.json({ error: "Too many tournaments at once. Try again later." }, { status: 429 });
    }

    const { secret, hash } = newSecret();
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = publicCode();
      const rows = await sql`
        INSERT INTO tournaments (code, key_hash, creator_hash, name, city, lat, lng, starts_on, overs, teams)
        VALUES (${code}, ${hash}, ${creator}, ${name}, ${city}, ${lat}, ${lng}, ${date}, ${overs},
                ${JSON.stringify(teams)}::jsonb)
        ON CONFLICT (code) DO NOTHING
        RETURNING code`;
      if (rows[0]) return NextResponse.json({ code, key: secret }, { status: 201 });
    }
    throw new Error("Could not find a free code.");
  } catch (err) {
    return failure(err);
  }
}
