/**
 * One line of commentary, spoken.
 *
 * Returns WAV bytes. Short lines, so a single response beats streaming here:
 * time-to-first-audio over SSE would be lower, but a one-sentence call is back
 * in well under a second and the playback code stays trivial.
 */

import { NextResponse } from "next/server";
import { GnaniError, speak, VOICES, type Voice } from "@/lib/gnani/client";
import { LANGUAGES, type LanguageCode } from "@/lib/gnani/languages";
import { voiceRefusal } from "@/lib/public/voice-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 400;

export async function POST(request: Request) {
  let body: { text?: string; language?: string; voice?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Nothing to say." }, { status: 400 });
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: "That line is too long." }, { status: 413 });
  }

  const language = (body.language ?? "hi-IN") as LanguageCode;
  if (!(language in LANGUAGES)) {
    return NextResponse.json({ error: `Unsupported language ${language}.` }, { status: 400 });
  }
  const voice = (body.voice ?? "Shubham") as Voice;
  if (!(voice in VOICES)) {
    return NextResponse.json({ error: `Unknown voice ${voice}.` }, { status: 400 });
  }

  const refusal = await voiceRefusal(request, "tts");
  if (refusal) return refusal;

  try {
    const audio = await speak({ text, language, voice });
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof GnaniError) {
      return NextResponse.json(
        { error: err.message, retry: err.isRateLimit },
        { status: err.status },
      );
    }
    console.error("tts route", err);
    return NextResponse.json({ error: "Could not synthesise that." }, { status: 500 });
  }
}
