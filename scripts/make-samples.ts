/**
 * Pre-renders the commentary clips the landing page plays.
 *
 * The page could call /api/tts live, but then every visitor spends quota on a
 * line that never changes, and a 429 on the one thing a judge clicks first is
 * not worth the realism. These are real Timbre output, generated once.
 *
 *   npx tsx --env-file=.env.local scripts/make-samples.ts
 */
import { writeFile } from "node:fs/promises";

import type { LanguageCode } from "../src/lib/gnani/languages";

// Called directly rather than through src/lib/gnani/client, which is marked
// server-only and will not load outside Next's server runtime.
type Voice = "Shubham" | "Riyaa" | "Lakshmi" | "Avinash" | "Shivani";

async function speak(opts: {
  text: string;
  language: LanguageCode;
  voice: Voice;
}): Promise<ArrayBuffer> {
  const key = process.env.GNANI_API_KEY;
  if (!key) throw new Error("GNANI_API_KEY is not set.");

  const res = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key-ID": key },
    body: JSON.stringify({
      text: opts.text,
      voice: opts.voice,
      model: "timbre-v3.0",
      language: opts.language,
      speed: 1.05,
      audio_config: {
        sample_rate: 24000,
        num_channels: 1,
        sample_width: 2,
        encoding: "linear_pcm",
        container: "wav",
      },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.arrayBuffer();
}

const CLIPS: {
  file: string;
  text: string;
  language: LanguageCode;
  voice: Voice;
}[] = [
  {
    file: "six-hi",
    text: "<excited>छक्का! रुत्विक ने गेंद मैदान के बाहर भेज दी। क्या शॉट था।",
    language: "hi-IN",
    voice: "Shubham",
  },
  {
    file: "four-mr",
    text: "<excited>चौकार! ओंकारचा सुंदर फटका. चेंडू सीमारेषेपार.",
    language: "mr-IN",
    voice: "Shubham",
  },
  {
    file: "wicket-en",
    text: "<shouting>Bowled him! Kaustubh walks back, and that is the breakthrough.",
    language: "en-IN",
    voice: "Shubham",
  },
];

async function main() {
  for (const clip of CLIPS) {
    process.stdout.write(`${clip.file} … `);
    const wav = await speak({ text: clip.text, language: clip.language, voice: clip.voice });
    await writeFile(`public/samples/${clip.file}.wav`, Buffer.from(wav));
    console.log(`${(wav.byteLength / 1024).toFixed(0)} KB`);
    // Some accounts allow one request at a time.
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
