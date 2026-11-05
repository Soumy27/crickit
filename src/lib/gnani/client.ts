/**
 * Gnani Speech API client.
 *
 * There is no official JavaScript SDK — `gnani-vachana` is Python — so this
 * talks to the REST endpoints directly. Server-side only: the key must never
 * reach the browser.
 */

import "server-only";

export const GNANI_BASE = "https://api.vachana.ai";

// One list, shared with the browser — see ./languages.
export { LANGUAGES, type LanguageCode } from "./languages";
import type { LanguageCode } from "./languages";
/** Prisma v3.0 can also work the language out for itself. */
export type SttLanguage = LanguageCode | "indic-auto";

export class GnaniError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "GnaniError";
  }

  /** A 429 means wait, not fail — some accounts allow one request at a time. */
  get isRateLimit(): boolean {
    return this.status === 429;
  }
}

function apiKey(): string {
  const key = process.env.GNANI_API_KEY;
  if (!key) {
    throw new GnaniError(
      "GNANI_API_KEY is not set. Add it to .env.local — see the README.",
      500,
    );
  }
  return key;
}

/**
 * Turns a failed response into an error a human can act on.
 *
 * Gnani returns `{"success":false,"error":{"type":...,"message":...}}`, and
 * the first version of this read `body.error` as a string — so every API
 * failure surfaced as the literal text "[object Object]". That is how an
 * outright "Unsupported audio format" for every WebM recording stayed
 * invisible long enough to ship.
 */
async function failure(res: Response): Promise<GnaniError> {
  let message = `${res.status} ${res.statusText}`;
  let code: string | undefined;

  try {
    const body: unknown = await res.json();
    const found = dig(body);
    if (found.message) message = found.message;
    code = found.code;
  } catch {
    // Not JSON. The status line is all we have.
  }

  return new GnaniError(message, res.status, code);
}

/** Pulls a message and a code out of the several envelope shapes in use. */
function dig(body: unknown): { message?: string; code?: string } {
  if (typeof body === "string") return { message: body };
  if (Array.isArray(body)) {
    // FastAPI validation errors arrive as a list of them.
    const parts = body.map((e) => dig(e).message).filter(Boolean);
    return parts.length ? { message: parts.join("; ") } : {};
  }
  if (!body || typeof body !== "object") return {};

  const o = body as Record<string, unknown>;
  const code =
    str(o.type) ?? str(o.error_code) ?? str(o.code) ?? undefined;
  const message = str(o.message) ?? str(o.msg) ?? str(o.detail);
  if (message) return { message, code };

  // Otherwise the useful part is nested: { error: {...} } or { detail: {...} }.
  for (const key of ["error", "detail", "data"]) {
    if (o[key] && typeof o[key] === "object") {
      const inner = dig(o[key]);
      if (inner.message) return { message: inner.message, code: inner.code ?? code };
    }
  }
  return code ? { code } : {};
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// ─── Speech to text ──────────────────────────────────────────────────────────

export type SttFormat = "verbatim" | "transcribe" | "codemix" | "transliterate";

export interface TranscribeOptions {
  audio: Blob;
  filename?: string;
  /** Default `indic-auto`: the scorer never has to pick a language. */
  language?: SttLanguage;
  /** Default `transcribe`, so numbers come back as digits. */
  format?: SttFormat;
  /** Up to 200. Squad names go here — it is what makes local names land. */
  keyterms?: readonly string[];
  /** Up to 1600 characters of context. */
  topic?: string;
  signal?: AbortSignal;
}

export interface TranscribeResult {
  transcript: string;
  requestId?: string;
  detectedLanguage?: string;
  processingTime?: number;
}

const KEYTERM_LIMIT = 200;
const TOPIC_LIMIT = 1600;

export async function transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("audio_file", opts.audio, opts.filename ?? "ball.webm");
  form.append("model", "prisma-v3.0");
  form.append("language_code", opts.language ?? "indic-auto");
  form.append("format", opts.format ?? "transcribe");

  if (opts.keyterms?.length) {
    // Over the limit the API rejects the request, so trim rather than fail.
    form.append("keyterms", JSON.stringify(opts.keyterms.slice(0, KEYTERM_LIMIT)));
  }
  if (opts.topic) {
    form.append("topic", opts.topic.slice(0, TOPIC_LIMIT));
  }

  const res = await fetch(`${GNANI_BASE}/stt/v3`, {
    method: "POST",
    headers: { "X-API-Key-ID": apiKey() },
    body: form,
    signal: opts.signal,
  });

  if (!res.ok) throw await failure(res);

  const body = (await res.json()) as {
    transcript?: string;
    request_id?: string;
    detected_language_code?: string;
    processing_time?: number;
  };

  return {
    transcript: (body.transcript ?? "").trim(),
    requestId: body.request_id,
    detectedLanguage: body.detected_language_code,
    processingTime: body.processing_time,
  };
}

// ─── Text to speech ──────────────────────────────────────────────────────────

/**
 * Timbre v3.0 voices. Every one speaks all ten languages, so a voice is chosen
 * for its character and the language is set separately.
 */
export const VOICES = {
  Shubham: "Energetic and confident — the commentary voice",
  Riyaa: "Confident and lively",
  Lakshmi: "Expressive and warm, for storytelling",
  Avinash: "Professional and firm",
  Shivani: "Warm and patient",
} as const;

export type Voice = keyof typeof VOICES;

export interface SpeakOptions {
  text: string;
  language: LanguageCode;
  voice?: Voice;
  /** 0.5–2.0. Commentary sits slightly fast. */
  speed?: number;
  signal?: AbortSignal;
}

/**
 * Synthesises to a single WAV. Commentary lines are one sentence, so the
 * round trip is short enough not to need streaming; SSE is there if it ever is.
 */
export async function speak(opts: SpeakOptions): Promise<ArrayBuffer> {
  const res = await fetch(`${GNANI_BASE}/api/v1/tts/inference`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key-ID": apiKey(),
    },
    body: JSON.stringify({
      text: opts.text,
      voice: opts.voice ?? "Shubham",
      model: "timbre-v3.0",
      language: opts.language,
      speed: opts.speed ?? 1.05,
      audio_config: {
        sample_rate: 24000,
        num_channels: 1,
        sample_width: 2,
        encoding: "linear_pcm",
        container: "wav",
      },
    }),
    signal: opts.signal,
  });

  if (!res.ok) throw await failure(res);
  return res.arrayBuffer();
}
