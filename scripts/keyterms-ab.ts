/**
 * Does `keyterms` actually rescue Indian names on telephone-grade audio?
 *
 * This is the Noise Canceller evidence and the interview answer, so it is an
 * experiment rather than a demo: same audio, same model, one variable.
 *
 * Chain per utterance:
 *   Timbre speaks it at 16 kHz
 *   → 8 kHz mono, band-limited to 300-3400 Hz (the actual telephone band)
 *   → G.726 ADPCM at 16 kbit/s and back (a real telephony codec)
 *   → optional synthetic crowd murmur at a set SNR
 *   → Prisma, with keyterms and without
 *
 * The noise is synthesised, not a real crowd, and the speech is synthetic, so
 * this measures the *channel*, not a maidan. Said plainly in the write-up.
 *
 *   npx tsx --env-file=.env.local scripts/keyterms-ab.ts
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseBall } from "../src/lib/parse/ball-parser";
import { cricketKeyterms } from "../src/lib/parse/lexicon";
import type { Player } from "../src/lib/scoring/types";

const KEY = process.env.GNANI_API_KEY;
if (!KEY) {
  console.error("GNANI_API_KEY is not set.");
  process.exit(1);
}

const OUT = "tmp/keyterms-ab";

/** Names a general recogniser has never seen. That is the whole point. */
const SQUAD = [
  "Rutvik", "Omkar", "Dhananjay", "Prathamesh", "Sarfaraz",
  "Yashwant", "Kaustubh", "Nilesh", "Tanmay", "Siddhesh",
];
const GROUNDS = ["Wagholi", "Kharadi", "Balewadi", "Hadapsar"];

interface Case {
  say: string;
  /** The name that has to survive the channel. */
  name: string;
  /** Devanagari spellings Prisma was actually observed to return. */
  aliases: string[];
  want: { batRuns?: number; extra?: string; wicket?: string };
}

const CASES: Case[] = [
  { say: "रुत्विक ने चौका मारा", name: "Rutvik", aliases: ["ऋत्विक", "रुत्विक"], want: { batRuns: 4 } },
  { say: "ओमकार ने छक्का मारा", name: "Omkar", aliases: ["ओंकार", "ओमकार"], want: { batRuns: 6 } },
  { say: "धनंजय बोल्ड हो गया", name: "Dhananjay", aliases: ["धनंजय"], want: { wicket: "bowled" } },
  { say: "प्रथमेश ने दो रन लिए", name: "Prathamesh", aliases: ["प्रथमेश"], want: { batRuns: 2 } },
  { say: "सरफराज रन आउट", name: "Sarfaraz", aliases: ["सरफराज"], want: { wicket: "run_out" } },
  { say: "कौस्तुभ ने एक रन लिया", name: "Kaustubh", aliases: ["कौस्तुभ"], want: { batRuns: 1 } },
];

type Condition = { id: string; label: string; snrDb: number | null };
const CONDITIONS: Condition[] = [
  { id: "clean", label: "Studio (16 kHz)", snrDb: null },
  { id: "tel", label: "Telephone (8 kHz, G.726)", snrDb: null },
  { id: "tel-15", label: "Telephone + crowd (15 dB SNR)", snrDb: 15 },
  { id: "tel-5", label: "Telephone + crowd (5 dB SNR)", snrDb: 5 },
];

const latinSquad: Player[] = [...SQUAD, ...GROUNDS].map((name, i) => ({ id: `p${i}`, name }));
const bilingualSquad: Player[] = latinSquad.map((p) => ({
  ...p,
  aliases: CASES.find((c) => c.name === p.name)?.aliases ?? [],
}));
const KEYTERMS = [...SQUAD, ...GROUNDS, ...cricketKeyterms()];

async function tts(text: string): Promise<Buffer> {
  const res = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key-ID": KEY! },
    body: JSON.stringify({
      text,
      voice: "Shubham",
      model: "timbre-v3.0",
      language: "hi-IN",
      speed: 1.0,
      audio_config: {
        sample_rate: 16000, num_channels: 1, sample_width: 2,
        encoding: "linear_pcm", container: "wav",
      },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

function ff(args: string[]) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

/** 16 kHz studio WAV in, telephone-grade WAV out. */
function degrade(src: string, dst: string, snrDb: number | null) {
  const base = dst.replace(/\.wav$/, "");
  // The telephone band, then a real narrowband codec round trip.
  ff(["-i", src, "-ar", "8000", "-ac", "1",
      "-af", "highpass=f=300,lowpass=f=3400", `${base}-band.wav`]);
  ff(["-i", `${base}-band.wav`, "-acodec", "g726", "-b:a", "16k", `${base}.g726.wav`]);
  ff(["-i", `${base}.g726.wav`, "-ar", "8000", "-ac", "1", `${base}-codec.wav`]);

  if (snrDb === null) {
    fs.renameSync(`${base}-codec.wav`, dst);
  } else {
    // Brown noise band-limited the same way reads closer to room murmur than
    // white noise. `volume=NdB` is a RELATIVE gain, not a target level, so the
    // noise has to be measured first and the gain worked out from it —
    // otherwise "5 dB SNR" is silently 30 dB and the condition means nothing.
    const speechDb = meanVolume(`${base}-codec.wav`);
    const rawNoise = `${base}-noise.wav`;
    const seconds = durationOf(`${base}-codec.wav`);
    ff(["-f", "lavfi", "-i",
        `anoisesrc=color=brown:sample_rate=8000:amplitude=0.9:duration=${seconds}`,
        "-af", "highpass=f=300,lowpass=f=3400", rawNoise]);
    const noiseDb = meanVolume(rawNoise);
    const gainDb = speechDb - snrDb - noiseDb;
    ff(["-i", `${base}-codec.wav`, "-i", rawNoise,
        "-filter_complex",
        `[1:a]volume=${gainDb.toFixed(2)}dB[nf];` +
        `[0:a][nf]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`,
        "-map", "[out]", "-ar", "8000", "-ac", "1", dst]);
    const got = meanVolume(dst);
    console.log(
      `    ${path.basename(dst)}: speech ${speechDb.toFixed(1)} dB, ` +
      `noise ${(noiseDb + gainDb).toFixed(1)} dB, mixed ${got.toFixed(1)} dB`,
    );
    fs.unlinkSync(rawNoise);
  }
  for (const f of [`${base}-band.wav`, `${base}.g726.wav`, `${base}-codec.wav`]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

function durationOf(file: string): number {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  return parseFloat(out.trim()) || 2;
}

function meanVolume(file: string): number {
  try {
    const out = execFileSync(
      "ffmpeg",
      ["-hide_banner", "-i", file, "-af", "volumedetect", "-f", "null", "-"],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    return parseFloat(String(out).match(/mean_volume:\s*(-?\d+\.?\d*)/)?.[1] ?? "-20");
  } catch (err) {
    const stderr = String((err as { stderr?: Buffer }).stderr ?? "");
    return parseFloat(stderr.match(/mean_volume:\s*(-?\d+\.?\d*)/)?.[1] ?? "-20");
  }
}

async function stt(file: string, withKeyterms: boolean): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const form = new FormData();
    form.append("audio_file", new Blob([new Uint8Array(fs.readFileSync(file))], { type: "audio/wav" }), path.basename(file));
    form.append("model", "prisma-v3.0");
    form.append("language_code", "indic-auto");
    form.append("format", "transcribe");
    if (withKeyterms) {
      form.append("keyterms", JSON.stringify(KEYTERMS.slice(0, 200)));
      form.append("topic", "Ball-by-ball commentary at a local cricket match in Pune, India.");
    }
    const res = await fetch("https://api.vachana.ai/stt/v3", {
      method: "POST", headers: { "X-API-Key-ID": KEY! }, body: form,
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`STT ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const body = (await res.json()) as { transcript?: string };
    return (body.transcript ?? "").trim();
  }
  throw new Error("rate limited after 4 attempts");
}

/** Did the parser attribute the delivery to the right player? */
function playerMatched(text: string, c: Case, squad: Player[]): boolean {
  const out = parseBall(text, { players: squad });
  return out.status === "parsed" && out.player?.name === c.name;
}

function deliveryCorrect(text: string, want: Case["want"]): boolean {
  const out = parseBall(text, { players: bilingualSquad });
  if (out.status !== "parsed") return false;
  const e = out.event;
  if (want.extra) return e.extra === want.extra;
  if (want.wicket) return e.wicket?.kind === want.wicket;
  return e.batRuns === want.batRuns && !e.extra && !e.wicket;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  type Tally = { latin: number; bilingual: number; delivery: number; n: number };
  const results = new Map<string, Tally>();
  const log: string[] = [];

  for (const [i, c] of CASES.entries()) {
    const clean = path.join(OUT, `${i}-clean.wav`);
    if (!fs.existsSync(clean)) fs.writeFileSync(clean, await tts(c.say));

    for (const cond of CONDITIONS) {
      const file = path.join(OUT, `${i}-${cond.id}.wav`);
      if (cond.id === "clean") {
        if (!fs.existsSync(file)) fs.copyFileSync(clean, file);
      } else if (!fs.existsSync(file)) {
        degrade(clean, file, cond.snrDb);
      }

      for (const withKt of [false, true]) {
        const key = `${cond.id}|${withKt}`;
        const t = results.get(key) ?? { latin: 0, bilingual: 0, delivery: 0, n: 0 };
        const text = await stt(file, withKt);
        if (playerMatched(text, c, latinSquad)) t.latin += 1;
        if (playerMatched(text, c, bilingualSquad)) t.bilingual += 1;
        if (deliveryCorrect(text, c.want)) t.delivery += 1;
        t.n += 1;
        results.set(key, t);
        log.push(`${cond.id.padEnd(8)} keyterms=${withKt ? "on " : "off"}  ${c.name.padEnd(12)} "${text}"`);
      }
    }
    process.stdout.write(".");
  }
  console.log("\n");
  console.log(log.join("\n"));

  console.log("\n" + "=".repeat(78));
  console.log(
    "condition".padEnd(32) +
      "Latin squad".padEnd(18) +
      "both scripts".padEnd(18) +
      "delivery",
  );
  console.log("-".repeat(80));
  for (const cond of CONDITIONS) {
    const off = results.get(`${cond.id}|false`)!;
    const on = results.get(`${cond.id}|true`)!;
    const pct = (x: number, n: number) => `${Math.round((x / n) * 100)}%`;
    const cell = (a: number, b: number, n: number) => `${pct(a, n)} -> ${pct(b, n)}`;
    console.log(
      cond.label.padEnd(32) +
        cell(off.latin, on.latin, off.n).padEnd(18) +
        cell(off.bilingual, on.bilingual, off.n).padEnd(18) +
        cell(off.delivery, on.delivery, off.n),
    );
  }
  console.log("-".repeat(80));
  console.log("each cell: keyterms off -> keyterms on");
  console.log("Latin squad  = squad list in Latin only (the naive build)");
  console.log("both scripts = squad list carrying Devanagari spellings too");
  fs.writeFileSync(path.join(OUT, "log.txt"), log.join("\n"));
}

main();
