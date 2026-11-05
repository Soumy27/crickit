/**
 * Turns a delivery into a line of commentary.
 *
 * Templates rather than an LLM, for three reasons: it is instant, it costs
 * nothing per ball, and it is deterministic, so replaying a match produces the
 * same commentary it produced live. The variety comes from picking among
 * phrasings with a seed derived from the ball itself.
 *
 * Timbre v3.0 audio tags are part of the line, not decoration — flat
 * commentary on a six is worse than no commentary at all.
 */

import type { BallEvent, InningsState } from "../scoring/types";
import type { LanguageCode } from "../gnani/client";

export interface CommentaryInput {
  event: BallEvent;
  /** State *after* the delivery. */
  state: InningsState;
  batterName: string;
  /** Kept for the richer phrasings to come; not every line names the bowler. */
  bowlerName?: string;
  language: LanguageCode;
}

type Phrases = {
  dot: string[];
  runs: (n: number, batter: string) => string[];
  four: (batter: string) => string[];
  six: (batter: string) => string[];
  wide: string[];
  noball: string[];
  bye: (n: number) => string[];
  legbye: (n: number) => string[];
  bowled: (batter: string) => string[];
  caught: (batter: string, fielder?: string) => string[];
  lbw: (batter: string) => string[];
  runOut: (batter: string) => string[];
  stumped: (batter: string) => string[];
  hitWicket: (batter: string) => string[];
  fifty: (batter: string, runs: number) => string;
  hundred: (batter: string, runs: number) => string;
  endOfOver: (over: number, runs: number, wickets: number) => string;
};

const HINDI: Phrases = {
  dot: ["कोई रन नहीं।", "डॉट बॉल।", "गेंद रोक दी।"],
  runs: (n, b) => [`${b} ने ${n} रन लिए।`, `${n} रन।`],
  four: (b) => [
    `<excited>चौका! ${b} ने शानदार शॉट लगाया।`,
    `<excited>चार रन! गेंद सीमा रेखा के पार।`,
  ],
  six: (b) => [
    `<excited>छक्का! ${b} ने गेंद मैदान के बाहर भेज दी।`,
    `<excited>छह रन! क्या शॉट था।`,
  ],
  wide: ["वाइड गेंद।", "वाइड, एक अतिरिक्त रन।"],
  noball: ["नो बॉल।", "नो बॉल, एक रन अतिरिक्त।"],
  bye: (n) => [`${n} बाई।`],
  legbye: (n) => [`${n} लेग बाई।`],
  bowled: (b) => [
    `<shouting>बोल्ड! ${b} चलते बने।`,
    `<shouting>क्लीन बोल्ड! विकेट बिखर गया।`,
  ],
  caught: (b, f) => [
    f
      ? `<shouting>कैच आउट! ${f} ने शानदार कैच लपका, ${b} आउट।`
      : `<shouting>कैच आउट! ${b} पवेलियन लौट रहे हैं।`,
  ],
  lbw: (b) => [`<shouting>एलबीडब्ल्यू! ${b} आउट।`],
  runOut: (b) => [`<shouting>रन आउट! ${b} क्रीज तक नहीं पहुँच पाए।`],
  stumped: (b) => [`<shouting>स्टंप्ड! ${b} आउट।`],
  hitWicket: (b) => [`<shouting>हिट विकेट! ${b} आउट।`],
  fifty: (b, r) => `<excited>${b} के ${r} रन पूरे! अर्धशतक।`,
  hundred: (b, r) => `<excited>शतक! ${b} ने ${r} रन बना लिए।`,
  endOfOver: (o, r, w) =>
    `<pauses>ओवर समाप्त। ${o}वें ओवर में ${r} रन${w > 0 ? ` और ${w} विकेट` : ""}।`,
};

const MARATHI: Phrases = {
  dot: ["धाव नाही।", "डॉट बॉल।"],
  runs: (n, b) => [`${b} ने ${n} धावा घेतल्या।`, `${n} धावा।`],
  four: (b) => [`<excited>चौकार! ${b} चा सुंदर फटका।`],
  six: (b) => [`<excited>षटकार! ${b} ने चेंडू मैदानाबाहेर पाठवला।`],
  wide: ["वाईड चेंडू।"],
  noball: ["नो बॉल।"],
  bye: (n) => [`${n} बाय।`],
  legbye: (n) => [`${n} लेग बाय।`],
  bowled: (b) => [`<shouting>त्रिफळाचीत! ${b} बाद।`],
  caught: (b, f) => [
    f ? `<shouting>झेलबाद! ${f} ने झेल घेतला, ${b} बाद।` : `<shouting>झेलबाद! ${b} बाद।`,
  ],
  lbw: (b) => [`<shouting>पायचीत! ${b} बाद।`],
  runOut: (b) => [`<shouting>धावबाद! ${b} बाद।`],
  stumped: (b) => [`<shouting>यष्टिचीत! ${b} बाद।`],
  hitWicket: (b) => [`<shouting>हिट विकेट! ${b} बाद।`],
  fifty: (b, r) => `<excited>${b} चे ${r} धावा पूर्ण! अर्धशतक।`,
  hundred: (b, r) => `<excited>शतक! ${b} ने ${r} धावा केल्या।`,
  endOfOver: (o, r, w) =>
    `<pauses>षटक संपले। ${o}व्या षटकात ${r} धावा${w > 0 ? ` आणि ${w} गडी बाद` : ""}।`,
};

const ENGLISH: Phrases = {
  dot: ["No run.", "Dot ball.", "Kept out."],
  runs: (n, b) => [`${b} takes ${n}.`, `${n} run${n > 1 ? "s" : ""}.`],
  four: (b) => [`<excited>Four! Beautiful shot from ${b}.`, `<excited>Four runs, all along the ground.`],
  six: (b) => [`<excited>Six! ${b} has sent that out of the ground.`, `<excited>Six! What a strike.`],
  wide: ["Wide.", "Wide, one extra."],
  noball: ["No ball.", "No ball, one extra."],
  bye: (n) => [`${n} bye${n > 1 ? "s" : ""}.`],
  legbye: (n) => [`${n} leg bye${n > 1 ? "s" : ""}.`],
  bowled: (b) => [`<shouting>Bowled him! ${b} has to go.`, `<shouting>Clean bowled!`],
  caught: (b, f) => [
    f ? `<shouting>Caught! Brilliant work by ${f}, ${b} is gone.` : `<shouting>Caught! ${b} departs.`,
  ],
  lbw: (b) => [`<shouting>LBW! ${b} is out.`],
  runOut: (b) => [`<shouting>Run out! ${b} never made the crease.`],
  stumped: (b) => [`<shouting>Stumped! ${b} is out.`],
  hitWicket: (b) => [`<shouting>Hit wicket! ${b} is out.`],
  fifty: (b, r) => `<excited>Fifty for ${b}, off to ${r}.`,
  hundred: (b, r) => `<excited>Hundred! ${b} brings up ${r}.`,
  endOfOver: (o, r, w) =>
    `<pauses>End of the over. ${r} from over ${o}${w > 0 ? `, and ${w} wicket${w > 1 ? "s" : ""}` : ""}.`,
};

const TAMIL: Phrases = {
  dot: ["ரன் இல்லை.", "டாட் பால்."],
  runs: (n, b) => [`${b} ${n} ரன் எடுத்தார்.`],
  four: (b) => [`<excited>ஃபோர்! ${b} அருமையான ஷாட்.`],
  six: (b) => [`<excited>சிக்ஸர்! ${b} பந்தை மைதானத்துக்கு வெளியே அனுப்பினார்.`],
  wide: ["வைடு."],
  noball: ["நோ பால்."],
  bye: (n) => [`${n} பை.`],
  legbye: (n) => [`${n} லெக் பை.`],
  bowled: (b) => [`<shouting>போல்ட்! ${b} அவுட்.`],
  caught: (b) => [`<shouting>கேட்ச்! ${b} அவுட்.`],
  lbw: (b) => [`<shouting>எல்பிடபிள்யூ! ${b} அவுட்.`],
  runOut: (b) => [`<shouting>ரன் அவுட்! ${b} அவுட்.`],
  stumped: (b) => [`<shouting>ஸ்டம்ப்ட்! ${b} அவுட்.`],
  hitWicket: (b) => [`<shouting>ஹிட் விக்கெட்! ${b} அவுட்.`],
  fifty: (b, r) => `<excited>${b} அரைசதம், ${r} ரன்கள்!`,
  hundred: (b, r) => `<excited>சதம்! ${b} ${r} ரன்கள்.`,
  endOfOver: (o, r, w) => `<pauses>ஓவர் முடிந்தது. ஓவர் ${o}: ${r} ரன்${w > 0 ? `, ${w} விக்கெட்` : ""}.`,
};

const TELUGU: Phrases = {
  dot: ["పరుగులు లేవు.", "డాట్ బాల్."],
  runs: (n, b) => [`${b} ${n} పరుగులు తీసుకున్నారు.`],
  four: (b) => [`<excited>ఫోర్! ${b} అద్భుతమైన షాట్.`],
  six: (b) => [`<excited>సిక్సర్! ${b} బంతిని మైదానం బయటకు పంపారు.`],
  wide: ["వైడ్."],
  noball: ["నో బాల్."],
  bye: (n) => [`${n} బై.`],
  legbye: (n) => [`${n} లెగ్ బై.`],
  bowled: (b) => [`<shouting>బౌల్డ్! ${b} అవుట్.`],
  caught: (b) => [`<shouting>క్యాచ్! ${b} అవుట్.`],
  lbw: (b) => [`<shouting>ఎల్బీడబ్ల్యూ! ${b} అవుట్.`],
  runOut: (b) => [`<shouting>రనౌట్! ${b} అవుట్.`],
  stumped: (b) => [`<shouting>స్టంప్డ్! ${b} అవుట్.`],
  hitWicket: (b) => [`<shouting>హిట్ వికెట్! ${b} అవుట్.`],
  fifty: (b, r) => `<excited>${b} అర్ధ శతకం, ${r} పరుగులు!`,
  hundred: (b, r) => `<excited>శతకం! ${b} ${r} పరుగులు.`,
  endOfOver: (o, r, w) => `<pauses>ఓవర్ ముగిసింది. ఓవర్ ${o}: ${r} పరుగులు${w > 0 ? `, ${w} వికెట్లు` : ""}.`,
};

const KANNADA: Phrases = {
  dot: ["ರನ್ ಇಲ್ಲ.", "ಡಾಟ್ ಬಾಲ್."],
  runs: (n, b) => [`${b} ${n} ರನ್ ಗಳಿಸಿದರು.`],
  four: (b) => [`<excited>ಫೋರ್! ${b} ಅದ್ಭುತ ಹೊಡೆತ.`],
  six: (b) => [`<excited>ಸಿಕ್ಸರ್! ${b} ಚೆಂಡನ್ನು ಮೈದಾನದ ಹೊರಗೆ ಕಳುಹಿಸಿದರು.`],
  wide: ["ವೈಡ್."],
  noball: ["ನೋ ಬಾಲ್."],
  bye: (n) => [`${n} ಬೈ.`],
  legbye: (n) => [`${n} ಲೆಗ್ ಬೈ.`],
  bowled: (b) => [`<shouting>ಬೌಲ್ಡ್! ${b} ಔಟ್.`],
  caught: (b) => [`<shouting>ಕ್ಯಾಚ್! ${b} ಔಟ್.`],
  lbw: (b) => [`<shouting>ಎಲ್‌ಬಿಡಬ್ಲ್ಯೂ! ${b} ಔಟ್.`],
  runOut: (b) => [`<shouting>ರನೌಟ್! ${b} ಔಟ್.`],
  stumped: (b) => [`<shouting>ಸ್ಟಂಪ್ಡ್! ${b} ಔಟ್.`],
  hitWicket: (b) => [`<shouting>ಹಿಟ್ ವಿಕೆಟ್! ${b} ಔಟ್.`],
  fifty: (b, r) => `<excited>${b} ಅರ್ಧಶತಕ, ${r} ರನ್!`,
  hundred: (b, r) => `<excited>ಶತಕ! ${b} ${r} ರನ್.`,
  endOfOver: (o, r, w) => `<pauses>ಓವರ್ ಮುಗಿಯಿತು. ಓವರ್ ${o}: ${r} ರನ್${w > 0 ? `, ${w} ವಿಕೆಟ್` : ""}.`,
};

const MALAYALAM: Phrases = {
  dot: ["റൺ ഇല്ല.", "ഡോട്ട് ബോൾ."],
  runs: (n, b) => [`${b} ${n} റൺ നേടി.`],
  four: (b) => [`<excited>ഫോർ! ${b} മനോഹരമായ ഷോട്ട്.`],
  six: (b) => [`<excited>സിക്സർ! ${b} പന്ത് മൈതാനത്തിന് പുറത്തേക്ക് അയച്ചു.`],
  wide: ["വൈഡ്."],
  noball: ["നോ ബോൾ."],
  bye: (n) => [`${n} ബൈ.`],
  legbye: (n) => [`${n} ലെഗ് ബൈ.`],
  bowled: (b) => [`<shouting>ബൗൾഡ്! ${b} ഔട്ട്.`],
  caught: (b) => [`<shouting>ക്യാച്ച്! ${b} ഔട്ട്.`],
  lbw: (b) => [`<shouting>എൽബിഡബ്ല്യു! ${b} ഔട്ട്.`],
  runOut: (b) => [`<shouting>റണ്ണൗട്ട്! ${b} ഔട്ട്.`],
  stumped: (b) => [`<shouting>സ്റ്റംപ്ഡ്! ${b} ഔട്ട്.`],
  hitWicket: (b) => [`<shouting>ഹിറ്റ് വിക്കറ്റ്! ${b} ഔട്ട്.`],
  fifty: (b, r) => `<excited>${b} അർധസെഞ്ചുറി, ${r} റൺസ്!`,
  hundred: (b, r) => `<excited>സെഞ്ചുറി! ${b} ${r} റൺസ്.`,
  endOfOver: (o, r, w) => `<pauses>ഓവർ കഴിഞ്ഞു. ഓവർ ${o}: ${r} റൺസ്${w > 0 ? `, ${w} വിക്കറ്റ്` : ""}.`,
};

const BENGALI: Phrases = {
  dot: ["কোনো রান নেই।", "ডট বল।"],
  runs: (n, b) => [`${b} ${n} রান নিলেন।`],
  four: (b) => [`<excited>চার! ${b} দুর্দান্ত শট।`],
  six: (b) => [`<excited>ছক্কা! ${b} বল মাঠের বাইরে পাঠালেন।`],
  wide: ["ওয়াইড।"],
  noball: ["নো বল।"],
  bye: (n) => [`${n} বাই।`],
  legbye: (n) => [`${n} লেগ বাই।`],
  bowled: (b) => [`<shouting>বোল্ড! ${b} আউট।`],
  caught: (b) => [`<shouting>ক্যাচ! ${b} আউট।`],
  lbw: (b) => [`<shouting>এলবিডব্লিউ! ${b} আউট।`],
  runOut: (b) => [`<shouting>রান আউট! ${b} আউট।`],
  stumped: (b) => [`<shouting>স্টাম্পড! ${b} আউট।`],
  hitWicket: (b) => [`<shouting>হিট উইকেট! ${b} আউট।`],
  fifty: (b, r) => `<excited>${b} অর্ধশতক, ${r} রান!`,
  hundred: (b, r) => `<excited>শতক! ${b} ${r} রান।`,
  endOfOver: (o, r, w) => `<pauses>ওভার শেষ। ওভার ${o}: ${r} রান${w > 0 ? `, ${w} উইকেট` : ""}।`,
};

const GUJARATI: Phrases = {
  dot: ["કોઈ રન નહીં.", "ડોટ બોલ."],
  runs: (n, b) => [`${b} એ ${n} રન લીધા.`],
  four: (b) => [`<excited>ચોગ્ગો! ${b} નો શાનદાર શોટ.`],
  six: (b) => [`<excited>છગ્ગો! ${b} એ બોલ મેદાનની બહાર મોકલ્યો.`],
  wide: ["વાઇડ."],
  noball: ["નો બોલ."],
  bye: (n) => [`${n} બાય.`],
  legbye: (n) => [`${n} લેગ બાય.`],
  bowled: (b) => [`<shouting>બોલ્ડ! ${b} આઉટ.`],
  caught: (b) => [`<shouting>કેચ! ${b} આઉટ.`],
  lbw: (b) => [`<shouting>એલબીડબલ્યુ! ${b} આઉટ.`],
  runOut: (b) => [`<shouting>રન આઉટ! ${b} આઉટ.`],
  stumped: (b) => [`<shouting>સ્ટમ્પ્ડ! ${b} આઉટ.`],
  hitWicket: (b) => [`<shouting>હિટ વિકેટ! ${b} આઉટ.`],
  fifty: (b, r) => `<excited>${b} ની અડધી સદી, ${r} રન!`,
  hundred: (b, r) => `<excited>સદી! ${b} ના ${r} રન.`,
  endOfOver: (o, r, w) => `<pauses>ઓવર પૂરી. ઓવર ${o}: ${r} રન${w > 0 ? `, ${w} વિકેટ` : ""}.`,
};

const PUNJABI: Phrases = {
  dot: ["ਕੋਈ ਦੌੜ ਨਹੀਂ।", "ਡਾਟ ਬਾਲ।"],
  runs: (n, b) => [`${b} ਨੇ ${n} ਦੌੜਾਂ ਲਈਆਂ।`],
  four: (b) => [`<excited>ਚੌਕਾ! ${b} ਦਾ ਸ਼ਾਨਦਾਰ ਸ਼ਾਟ।`],
  six: (b) => [`<excited>ਛੱਕਾ! ${b} ਨੇ ਗੇਂਦ ਮੈਦਾਨ ਤੋਂ ਬਾਹਰ ਭੇਜੀ।`],
  wide: ["ਵਾਈਡ।"],
  noball: ["ਨੋ ਬਾਲ।"],
  bye: (n) => [`${n} ਬਾਈ।`],
  legbye: (n) => [`${n} ਲੈੱਗ ਬਾਈ।`],
  bowled: (b) => [`<shouting>ਬੋਲਡ! ${b} ਆਊਟ।`],
  caught: (b) => [`<shouting>ਕੈਚ! ${b} ਆਊਟ।`],
  lbw: (b) => [`<shouting>ਐਲਬੀਡਬਲਯੂ! ${b} ਆਊਟ।`],
  runOut: (b) => [`<shouting>ਰਨ ਆਊਟ! ${b} ਆਊਟ।`],
  stumped: (b) => [`<shouting>ਸਟੰਪਡ! ${b} ਆਊਟ।`],
  hitWicket: (b) => [`<shouting>ਹਿੱਟ ਵਿਕਟ! ${b} ਆਊਟ।`],
  fifty: (b, r) => `<excited>${b} ਦਾ ਅਰਧ ਸੈਂਕੜਾ, ${r} ਦੌੜਾਂ!`,
  hundred: (b, r) => `<excited>ਸੈਂਕੜਾ! ${b} ਦੀਆਂ ${r} ਦੌੜਾਂ।`,
  endOfOver: (o, r, w) => `<pauses>ਓਵਰ ਖਤਮ। ਓਵਰ ${o}: ${r} ਦੌੜਾਂ${w > 0 ? `, ${w} ਵਿਕਟਾਂ` : ""}।`,
};

const BY_LANGUAGE: Record<LanguageCode, Phrases> = {
  "hi-IN": HINDI,
  "mr-IN": MARATHI,
  "en-IN": ENGLISH,
  "ta-IN": TAMIL,
  "te-IN": TELUGU,
  "kn-IN": KANNADA,
  "ml-IN": MALAYALAM,
  "bn-IN": BENGALI,
  "gu-IN": GUJARATI,
  "pa-IN": PUNJABI,
};

/** Deterministic pick, so replaying a match reproduces its commentary. */
function pick(options: string[], seed: number): string {
  return options[seed % options.length];
}

function seedOf(state: InningsState, ev: BallEvent): number {
  return state.legalBalls * 7 + ev.batRuns * 3 + ev.extraRuns + (ev.wicket ? 11 : 0);
}

export interface CommentaryLine {
  /** Includes Timbre audio tags, ready to synthesise. */
  text: string;
  /** Tags stripped, for the on-screen feed. */
  plain: string;
}

export function generateCommentary(input: CommentaryInput): CommentaryLine {
  const { event: ev, state, batterName, language } = input;
  const p = BY_LANGUAGE[language] ?? ENGLISH;
  const seed = seedOf(state, ev);
  const parts: string[] = [];

  if (ev.wicket) {
    const { kind, fielder } = ev.wicket;
    const lines =
      kind === "bowled" ? p.bowled(batterName)
      : kind === "caught" ? p.caught(batterName, fielder)
      : kind === "lbw" ? p.lbw(batterName)
      : kind === "run_out" ? p.runOut(batterName)
      : kind === "stumped" ? p.stumped(batterName)
      : p.hitWicket(batterName);
    parts.push(pick(lines, seed));
  } else if (ev.extra === "wide") {
    parts.push(pick(p.wide, seed));
  } else if (ev.extra === "noball") {
    parts.push(pick(p.noball, seed));
  } else if (ev.extra === "bye") {
    parts.push(pick(p.bye(ev.extraRuns), seed));
  } else if (ev.extra === "legbye") {
    parts.push(pick(p.legbye(ev.extraRuns), seed));
  } else if (ev.batRuns === 6) {
    parts.push(pick(p.six(batterName), seed));
  } else if (ev.batRuns === 4) {
    parts.push(pick(p.four(batterName), seed));
  } else if (ev.batRuns === 0) {
    parts.push(pick(p.dot, seed));
  } else {
    parts.push(pick(p.runs(ev.batRuns, batterName), seed));
  }

  // Milestones, only on the ball that brings them up.
  const batter = Object.values(state.batters).find((b) => b.name === batterName);
  if (batter && ev.batRuns > 0) {
    const before = batter.runs - ev.batRuns;
    if (before < 50 && batter.runs >= 50 && batter.runs < 100) {
      parts.push(p.fifty(batterName, batter.runs));
    } else if (before < 100 && batter.runs >= 100) {
      parts.push(p.hundred(batterName, batter.runs));
    }
  }

  const over = state.overs.find((o) => o.complete && o.marks.length > 0 && o.number === state.overs.filter((x) => x.complete).length);
  if (over?.complete && state.awaiting.includes("new_bowler")) {
    parts.push(p.endOfOver(over.number, over.runs, over.wickets));
  }

  const text = parts.join(" ");
  return { text, plain: stripTags(text) };
}

/** Timbre speaks these; the screen should not show them. */
export function stripTags(text: string): string {
  return text.replace(/<[a-z ]+>/g, "").replace(/\s+/g, " ").trim();
}
