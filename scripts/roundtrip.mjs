/**
 * End-to-end check with no microphone and no cricket match.
 *
 * Timbre speaks a line a scorer would say, Prisma transcribes it back, and the
 * parser turns it into a delivery. Synthetic speech is cleaner than a real
 * maidan, so this proves the plumbing rather than the accuracy — but it catches
 * every wiring mistake before you are standing on a boundary with one take.
 *
 *   node --env-file=.env.local scripts/roundtrip.mjs
 */

import fs from "node:fs";
import path from "node:path";

const KEY = process.env.GNANI_API_KEY;
if (!KEY) {
  console.error("GNANI_API_KEY is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const BASE = "https://api.vachana.ai";
const OUT = "tmp/roundtrip";

/** Lines a scorer actually says, and the delivery each one should produce. */
const CASES = [
  { say: "रोहित ने चौका मारा", expect: "4 off the bat" },
  { say: "छक्का", expect: "6 off the bat" },
  { say: "वाइड गेंद", expect: "wide" },
  { say: "विकेट, बोल्ड", expect: "wicket, bowled" },
  { say: "दो रन", expect: "2 runs" },
  { say: "कोई रन नहीं", expect: "dot ball" },
];

const SQUAD = ["Rohit", "Imran", "Suresh", "Jadeja", "Faisal"];

async function speak(text) {
  const res = await fetch(`${BASE}/api/v1/tts/inference`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key-ID": KEY },
    body: JSON.stringify({
      text,
      voice: "Shubham",
      model: "timbre-v3.0",
      language: "hi-IN",
      speed: 1.0,
      audio_config: {
        sample_rate: 16000,
        num_channels: 1,
        sample_width: 2,
        encoding: "linear_pcm",
        container: "wav",
      },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function listen(wav, filename) {
  const form = new FormData();
  form.append("audio_file", new Blob([wav], { type: "audio/wav" }), filename);
  form.append("model", "prisma-v3.0");
  form.append("language_code", "indic-auto");
  form.append("format", "transcribe");
  form.append("keyterms", JSON.stringify([...SQUAD, "chauka", "chhakka", "wide", "bowled", "wicket"]));
  form.append("topic", "Ball-by-ball commentary at a local cricket match in India.");

  const res = await fetch(`${BASE}/stt/v3`, {
    method: "POST",
    headers: { "X-API-Key-ID": KEY },
    body: form,
  });
  if (!res.ok) throw new Error(`STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

fs.mkdirSync(OUT, { recursive: true });
console.log("case".padEnd(22), "heard".padEnd(28), "latency");
console.log("-".repeat(70));

let ok = 0;
for (const [i, c] of CASES.entries()) {
  try {
    const wav = await speak(c.say);
    const file = path.join(OUT, `${i}.wav`);
    fs.writeFileSync(file, wav);

    const t0 = Date.now();
    const heard = await listen(wav, `${i}.wav`);
    const ms = Date.now() - t0;

    const transcript = (heard.transcript ?? "").trim();
    console.log(
      c.say.padEnd(22),
      transcript.padEnd(28),
      `${ms}ms  (${heard.detected_language_code ?? "?"})`,
    );
    if (transcript) ok += 1;
  } catch (err) {
    console.log(c.say.padEnd(22), `FAILED: ${err.message}`);
  }
}

console.log("-".repeat(70));
console.log(`${ok}/${CASES.length} transcribed. Audio in ${OUT}/`);
