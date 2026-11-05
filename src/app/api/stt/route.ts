/**
 * One utterance in, one delivery out.
 *
 * The browser posts the audio for a single ball; this transcribes it with
 * Prisma and runs the lexicon parser over the result. Nothing is committed
 * here — the client shows the parsed delivery for confirmation first.
 */

import { NextResponse } from "next/server";
import { GnaniError, transcribe, type SttLanguage } from "@/lib/gnani/client";
import { parseBall } from "@/lib/parse/ball-parser";
import { LANGUAGES, type LanguageCode } from "@/lib/gnani/languages";
import { cricketKeyterms } from "@/lib/parse/lexicon";
import { voiceRefusal } from "@/lib/public/voice-limit";
import type { Player } from "@/lib/scoring/types";

export const runtime = "nodejs";
/** Audio is per-ball and never cached. */
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 2_000_000; // a ball is ~1s; anything larger is wrong
const TOPIC =
  "Ball-by-ball commentary at a local cricket match in India. The speaker " +
  "calls runs, extras and dismissals in an Indian language or English, often " +
  "mixing them in one sentence.";

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No audio in the request." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "That clip is too long for one delivery." },
      { status: 413 },
    );
  }

  /*
   * Safari records mp4, Chrome webm. Naming every clip "ball.webm" sent
   * Safari's recordings up with an extension that contradicted their bytes,
   * and nothing a Safari user said was ever transcribed.
   */
  const filename =
    audio instanceof File && /^ball\.[a-z0-9]{2,4}$/i.test(audio.name)
      ? audio.name
      : `ball.${extensionFromType(audio.type)}`;

  const refusal = await voiceRefusal(request, "stt");
  if (refusal) return refusal;

  const language = (form.get("language") as SttLanguage | null) ?? "indic-auto";
  const players = parsePlayers(form.get("players"));

  // Squad names first: they are the terms a general model has never heard,
  // and the 200-term budget is shared with the cricket vocabulary.
  const rawHint = form.get("hint");
  const hint = typeof rawHint === "string" && rawHint in LANGUAGES ? (rawHint as LanguageCode) : undefined;
  const keyterms = [
    ...players.flatMap((p) => [p.name, ...(p.aliases ?? [])]),
    ...cricketKeyterms(hint),
  ];

  try {
    let result = await transcribe({
      audio,
      filename,
      language,
      format: "transcribe",
      keyterms,
      topic: TOPIC,
    });

    // Auto-detect can land on the wrong language for one short word, and Prisma
    // then writes it in that script. If what came back is not a ball, listen once
    // more in the language the scorer set the app to, before bothering them.
    let parse = parseBall(result.transcript, { players });
    if (
      parse.status === "unparsed" && language === "indic-auto" &&
      hint && hint !== result.detectedLanguage
    ) {
      const again = await transcribe({
        audio, filename, language: hint as SttLanguage, format: "transcribe", keyterms, topic: TOPIC,
      });
      const second = parseBall(again.transcript, { players });
      if (second.status !== "unparsed") {
        result = again;
        parse = second;
      }
    }

    if (!result.transcript) {
      return NextResponse.json({
        transcript: "",
        parse: { status: "unparsed", transcript: "" },
        detectedLanguage: result.detectedLanguage,
      });
    }

    return NextResponse.json({
      transcript: result.transcript,
      parse,
      detectedLanguage: result.detectedLanguage,
      processingTime: result.processingTime,
    });
  } catch (err) {
    if (err instanceof GnaniError) {
      // A 429 is "wait", not "failed" — some accounts allow one call at a time.
      return NextResponse.json(
        { error: err.message, code: err.code, retry: err.isRateLimit },
        { status: err.status },
      );
    }
    console.error("stt route", err);
    return NextResponse.json({ error: "Transcription failed." }, { status: 500 });
  }
}

/** Matches the container to an extension the speech API will believe. */
function extensionFromType(type: string): string {
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg")) return "mp3";
  return "webm";
}

function parsePlayers(raw: FormDataEntryValue | null): Player[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Player =>
        typeof p === "object" && p !== null &&
        typeof (p as Player).id === "string" &&
        typeof (p as Player).name === "string",
    );
  } catch {
    return [];
  }
}
