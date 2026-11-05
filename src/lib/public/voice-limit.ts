import "server-only";

import { NextResponse } from "next/server";
import { creatorHash, db } from "./db";
import {
  dayStart,
  decideVoice,
  hourStart,
  limitFromEnv,
  VOICE_DAILY_DEFAULT,
  VOICE_HOURLY_DEFAULT,
  type VoiceKind,
} from "./voice-rules";

/** A slow check must not hold up a ball; past this the call simply goes through. */
const CHECK_TIMEOUT_MS = 1200;

const MESSAGES = {
  connection: "Voice has been used a lot from this connection. Use the keypad for now, and try again in a while.",
  everyone: "Voice is resting for today. Use the keypad, and your match will still score normally.",
};

async function usage(kind: VoiceKind, connection: string, hourlyLimit: number, now: Date) {
  // One statement, so the daily total only counts calls this connection is allowed.
  // Otherwise one person hammering the endpoint could use up everyone's day.
  const rows = await db()`
    WITH mine AS (
      INSERT INTO voice_usage (bucket, window_start)
      VALUES (${`${kind}:${connection}`}, ${hourStart(now)})
      ON CONFLICT (bucket, window_start) DO UPDATE SET count = voice_usage.count + 1
      RETURNING count
    ),
    everyone AS (
      INSERT INTO voice_usage (bucket, window_start)
      SELECT ${`${kind}:all`}::text, ${dayStart(now)}::timestamptz FROM mine WHERE mine.count <= ${hourlyLimit}::int
      ON CONFLICT (bucket, window_start) DO UPDATE SET count = voice_usage.count + 1
      RETURNING count
    )
    SELECT (SELECT count FROM mine) AS mine, (SELECT count FROM everyone) AS everyone`;
  return { mine: rows[0].mine as number, everyone: rows[0].everyone as number | null };
}

/**
 * Returns a response if this voice call should be refused, or null to let it through.
 *
 * Fails open: if the database is slow or down, voice still works. A demo losing
 * its main feature to a broken limiter is worse than a few uncounted calls.
 */
export async function voiceRefusal(request: Request, kind: VoiceKind): Promise<NextResponse | null> {
  const hourly = limitFromEnv(process.env.VOICE_HOURLY_LIMIT, VOICE_HOURLY_DEFAULT);
  const daily = limitFromEnv(process.env.VOICE_DAILY_LIMIT, VOICE_DAILY_DEFAULT);

  try {
    const counted = await Promise.race([
      usage(kind, creatorHash(request), hourly, new Date()),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CHECK_TIMEOUT_MS)),
    ]);
    if (!counted) return null;

    const refused = decideVoice(counted, { hourly, daily });
    if (!refused) return null;
    return NextResponse.json(
      { error: MESSAGES[refused], limited: true, retry: false },
      { status: 429, headers: { "Retry-After": refused === "connection" ? "3600" : "21600" } },
    );
  } catch (err) {
    console.error("voice limit", err);
    return null;
  }
}
