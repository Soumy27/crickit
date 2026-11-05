/**
 * Which Prisma output style is easiest to parse into a delivery?
 *
 * Prisma v3.0 writes the same audio four ways. The choice is not cosmetic
 * here: the parser has to turn the text into a ball, so the most *consistent*
 * format wins, even if another reads better to a human.
 *
 * Reuses the audio in tmp/roundtrip, so run roundtrip.mjs first.
 *
 *   npx tsx --env-file=.env.local scripts/compare-formats.ts
 */

import fs from "node:fs";
import path from "node:path";
import { parseBall } from "../src/lib/parse/ball-parser";
import type { Player } from "../src/lib/scoring/types";

const KEY = process.env.GNANI_API_KEY;
if (!KEY) {
  console.error("GNANI_API_KEY is not set.");
  process.exit(1);
}

const SRC = "tmp/roundtrip";
const FORMATS = ["transcribe", "codemix", "transliterate", "verbatim"] as const;
const SQUAD = ["Rohit", "Imran", "Suresh", "Jadeja", "Faisal"];
const players: Player[] = SQUAD.map((name, i) => ({ id: `p${i}`, name }));

interface Case {
  file: string;
  said: string;
  want: { batRuns?: number; extra?: string; wicket?: string };
}

const CASES: Case[] = [
  { file: "0.wav", said: "रोहित ने चौका मारा", want: { batRuns: 4 } },
  { file: "1.wav", said: "छक्का", want: { batRuns: 6 } },
  { file: "2.wav", said: "वाइड गेंद", want: { extra: "wide" } },
  { file: "3.wav", said: "विकेट, बोल्ड", want: { wicket: "bowled" } },
  { file: "4.wav", said: "दो रन", want: { batRuns: 2 } },
  { file: "5.wav", said: "कोई रन नहीं", want: { batRuns: 0 } },
];

async function listen(wav: Buffer, filename: string, format: string) {
  const form = new FormData();
  form.append("audio_file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), filename);
  form.append("model", "prisma-v3.0");
  form.append("language_code", "indic-auto");
  form.append("format", format);
  form.append(
    "keyterms",
    JSON.stringify([...SQUAD, "chauka", "chhakka", "wide", "bowled", "wicket"]),
  );
  form.append("topic", "Ball-by-ball commentary at a local cricket match in India.");

  const res = await fetch("https://api.vachana.ai/stt/v3", {
    method: "POST",
    headers: { "X-API-Key-ID": KEY! },
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { transcript?: string };
}

function correct(text: string, want: Case["want"]): boolean {
  const out = parseBall(text, { players });
  if (out.status !== "parsed") return false;
  const e = out.event;
  if (want.extra !== undefined) return e.extra === want.extra;
  if (want.wicket !== undefined) return e.wicket?.kind === want.wicket;
  return e.batRuns === want.batRuns && !e.extra && !e.wicket;
}

async function main() {
  const score: Record<string, number> = Object.fromEntries(FORMATS.map((f) => [f, 0]));

  for (const c of CASES) {
    const wav = fs.readFileSync(path.join(SRC, c.file));
    console.log(`\n${c.said}`);
    for (const format of FORMATS) {
      try {
        const heard = await listen(wav, c.file, format);
        const text = (heard.transcript ?? "").trim();
        const ok = correct(text, c.want);
        if (ok) score[format] += 1;
        console.log(`  ${format.padEnd(14)} ${ok ? "ok " : "-- "} ${text}`);
      } catch (err) {
        console.log(`  ${format.padEnd(14)} ERR ${(err as Error).message}`);
      }
    }
  }

  console.log("\n" + "=".repeat(62));
  for (const f of FORMATS) {
    console.log(`${f.padEnd(14)} ${score[f]}/${CASES.length} parsed into the right delivery`);
  }
}

main();
