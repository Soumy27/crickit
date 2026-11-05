/**
 * Does calling a ball work in every language, through the real speech models?
 *
 * Each phrase is spoken by Timbre, heard by Prisma on `indic-auto` with the
 * same hints the app sends, and read by the real parser. Synthetic voices, so
 * this shows the pipeline works per language, not how a real scorer will fare.
 *
 *   npx tsx --env-file=.env.local scripts/language-matrix.ts [hi-IN ta-IN ...]
 */
import { writeFile } from "node:fs/promises";
import { parseBall } from "../src/lib/parse/ball-parser";
import { cricketKeyterms } from "../src/lib/parse/lexicon";
import { LANGUAGES, type LanguageCode } from "../src/lib/gnani/languages";
import { describeBall } from "../src/lib/scoring/describe";

const CASES: Record<LanguageCode, [string, string][]> = {
  "en-IN": [["Four runs", "Four"], ["That is a six", "Six"], ["Two runs", "2 runs"], ["No run, dot ball", "Dot ball"], ["Wide ball", "Wide"], ["No ball", "No ball"], ["Clean bowled", "Bowled"], ["Caught behind", "Caught"]],
  "hi-IN": [["चौका", "Four"], ["एक छक्का", "Six"], ["दो रन", "2 runs"], ["कोई रन नहीं", "Dot ball"], ["वाइड गेंद", "Wide"], ["नो बॉल", "No ball"], ["क्लीन बोल्ड", "Bowled"], ["कैच आउट", "Caught"]],
  "mr-IN": [["चौकार", "Four"], ["षटकार", "Six"], ["दोन धावा", "2 runs"], ["धाव नाही", "Dot ball"], ["वाइड चेंडू", "Wide"], ["नो बॉल", "No ball"], ["त्रिफळाचीत", "Bowled"], ["झेलबाद", "Caught"]],
  "ta-IN": [["ஃபோர்", "Four"], ["ஒரு சிக்ஸர்", "Six"], ["இரண்டு ரன்", "2 runs"], ["ரன் இல்லை", "Dot ball"], ["வைடு பந்து", "Wide"], ["நோ பால்", "No ball"], ["கிளீன் போல்ட்", "Bowled"], ["கேட்ச் அவுட்", "Caught"]],
  "te-IN": [["ఫోర్", "Four"], ["సిక్సర్", "Six"], ["రెండు పరుగులు", "2 runs"], ["పరుగులు లేవు", "Dot ball"], ["వైడ్ బాల్", "Wide"], ["నో బాల్", "No ball"], ["క్లీన్ బౌల్డ్", "Bowled"], ["క్యాచ్ అవుట్", "Caught"]],
  "kn-IN": [["ಫೋರ್", "Four"], ["ಸಿಕ್ಸರ್", "Six"], ["ಎರಡು ರನ್", "2 runs"], ["ರನ್ ಇಲ್ಲ", "Dot ball"], ["ವೈಡ್ ಬಾಲ್", "Wide"], ["ನೋ ಬಾಲ್", "No ball"], ["ಕ್ಲೀನ್ ಬೌಲ್ಡ್", "Bowled"], ["ಕ್ಯಾಚ್ ಔಟ್", "Caught"]],
  "ml-IN": [["ഫോർ", "Four"], ["സിക്സർ", "Six"], ["രണ്ട് റൺ", "2 runs"], ["റൺ ഇല്ല", "Dot ball"], ["വൈഡ് ബോൾ", "Wide"], ["നോ ബോൾ", "No ball"], ["ക്ലീൻ ബൗൾഡ്", "Bowled"], ["ക്യാച്ച് ഔട്ട്", "Caught"]],
  "bn-IN": [["চার রান", "Four"], ["ছক্কা", "Six"], ["দুই রান", "2 runs"], ["কোনো রান নেই", "Dot ball"], ["ওয়াইড বল", "Wide"], ["নো বল", "No ball"], ["ক্লিন বোল্ড", "Bowled"], ["ক্যাচ আউট", "Caught"]],
  "gu-IN": [["ચોગ્ગો", "Four"], ["છગ્ગો", "Six"], ["બે રન", "2 runs"], ["કોઈ રન નહીં", "Dot ball"], ["વાઇડ બોલ", "Wide"], ["નો બોલ", "No ball"], ["ક્લીન બોલ્ડ", "Bowled"], ["કેચ આઉટ", "Caught"]],
  "pa-IN": [["ਚੌਕਾ", "Four"], ["ਛੱਕਾ", "Six"], ["ਦੋ ਦੌੜਾਂ", "2 runs"], ["ਕੋਈ ਦੌੜ ਨਹੀਂ", "Dot ball"], ["ਵਾਈਡ ਗੇਂਦ", "Wide"], ["ਨੋ ਬਾਲ", "No ball"], ["ਕਲੀਨ ਬੋਲਡ", "Bowled"], ["ਕੈਚ ਆਊਟ", "Caught"]],
};

const OUT = process.env.MATRIX_OUT ?? "language-matrix.md";
const HEADER = "| Language | Said | Prisma heard | Detected | Wanted | Parsed | OK |\n|---|---|---|---|---|---|---|\n";
const key = process.env.GNANI_API_KEY;
if (!key) throw new Error("GNANI_API_KEY is not set.");
const BASE = "https://api.vachana.ai";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retrying(call: () => Promise<Response>): Promise<Response> {
  for (let i = 0; ; i++) {
    try {
      const res = await call();
      if (res.status !== 429 || i === 4) return res;
    } catch (err) {
      // A dropped connection is the network, not the language under test.
      if (i === 4) throw err;
    }
    await sleep(2000 * (i + 1));
  }
}

async function run(language: LanguageCode, phrase: string) {
  const tts = await retrying(() => fetch(`${BASE}/api/v1/tts/inference`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key-ID": key! },
    body: JSON.stringify({
      text: phrase, voice: "Shubham", model: "timbre-v3.0", language, speed: 1,
      audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" },
    }),
  }));
  if (!tts.ok) return { heard: `TTS ${tts.status}`, lang: "", got: "" };
  const wav = await tts.arrayBuffer();

  const hear = async (languageCode: string) => {
  const res = await retrying(() => {
    const form = new FormData();
    form.append("audio_file", new Blob([wav], { type: "audio/wav" }), "ball.wav");
    form.append("model", "prisma-v3.0");
    form.append("language_code", languageCode);
    form.append("format", "transcribe");
    form.append("keyterms", JSON.stringify(cricketKeyterms(language).slice(0, 200)));
    form.append("topic", "Ball-by-ball commentary at a local cricket match in India.");
    return fetch(`${BASE}/stt/v3`, { method: "POST", headers: { "X-API-Key-ID": key! }, body: form });
  });
  if (!res.ok) return { heard: `STT ${res.status}`, lang: "", got: "" };
  const body = (await res.json()) as { transcript?: string; detected_language_code?: string };
  const heard = (body.transcript ?? "").trim();
  const parse = parseBall(heard);
  const got = parse.status === "parsed" ? describeBall(parse.event) : parse.status;
  return { heard, lang: body.detected_language_code ?? "", got };
  };
  // The same second listen the app's route does, with the app set to this language.
  const first = await hear("indic-auto");
  if (first.got !== "unparsed" || first.lang === language) return first;
  const second = await hear(language);
  return second.got === "unparsed" ? first : { ...second, heard: `${second.heard} (2nd listen)` };
}

async function main() {
  const wanted = process.argv.slice(2);
  const langs = (wanted.length ? wanted : Object.keys(LANGUAGES)) as LanguageCode[];
  const rows: string[] = [];
  let pass = 0, total = 0;
  for (const language of langs) {
    let langPass = 0;
    for (const [phrase, want] of CASES[language]) {
      const { heard, lang, got } = await run(language, phrase);
      const ok = got === want;
      total++; if (ok) { pass++; langPass++; }
      rows.push(`| ${language} | ${phrase} | ${heard} | ${lang} | ${want} | ${got} | ${ok ? "yes" : "NO"} |`);
      await writeFile(OUT, HEADER + rows.join("\n") + "\n");
      await sleep(300);
    }
    console.log(`${language}: ${langPass}/${CASES[language].length}`);
  }
  console.log(`TOTAL ${pass}/${total}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
