/**
 * What a scorer actually says, in the languages they actually say it in.
 *
 * Prisma can return native script or Latin depending on `format`, and a scorer
 * switches between them mid-sentence anyway, so terms are listed in both.
 * The ten languages are the ten Prisma recognises: a language the model can
 * hear and this table cannot read is a scorer told "use the keys" on every ball.
 *
 * The cricket word in local script ("ஃபோர்", "ಸಿಕ್ಸರ್") sits beside the native
 * number, because that is how the game is called in all of these.
 */

import type { LanguageCode } from "../gnani/languages";

export interface Term {
  /** What it means. */
  readonly value: string;
  /** Every way it gets said. Matched on word boundaries, longest first. */
  readonly says: readonly string[];
}

type Words = Partial<Record<string, readonly string[]>>;

/** Latin script: English, plus Hindi and Marathi as Prisma romanises them. */
const LATIN: Words = {
  "0": ["dot ball", "dot", "khali", "khaali", "no run", "koi run nahi", "dhav nahi"],
  "1": ["single", "ek run", "one run", "ek", "one"],
  "2": ["double", "do run", "two run", "don dhava", "do", "two"],
  "3": ["teen run", "three run", "teen", "three"],
  "4": ["chauka", "chowka", "choka", "chaukar", "boundary", "four runs", "char run", "four", "char"],
  "5": ["paanch run", "five run", "paanch", "five"],
  "6": ["chhakka", "chakka", "chhaka", "shatkar", "sixer", "six runs", "chhe run", "six", "chhe"],
  legbye: ["leg bye", "legbye", "leg byes"],
  noball: ["no ball", "noball", "no-ball"],
  wide: ["wide ball", "wide"],
  bye: ["byes", "bye"],
  hit_wicket: ["hit wicket"],
  run_out: ["run out", "runout", "rann out"],
  stumped: ["stumped", "stumping", "stump out", "stump"],
  lbw: ["leg before wicket", "leg before", "lbw", "l b w"],
  bowled: ["clean bowled", "bowled", "bold"],
  caught: ["caught behind", "catch out", "caught", "catch", "pakad liya", "pakda"],
  generic: ["wicket", "out ho gaya", "out", "gaya"],
};

const NATIVE: Record<Exclude<LanguageCode, "en-IN">, Words> = {
  "hi-IN": {
    "0": ["डॉट", "खाली", "कोई रन नहीं"],
    "1": ["एक", "सिंगल"],
    "2": ["दो", "डबल"],
    "3": ["तीन"],
    "4": ["चौका", "चौके", "चार", "बाउंड्री"],
    "5": ["पांच", "पाँच"],
    "6": ["छक्का", "छक्के", "छह"],
    legbye: ["लेग बाई", "लेग बाय"],
    noball: ["नो बॉल", "नोबॉल"],
    wide: ["वाइड", "वाईड"],
    bye: ["बाई", "बाय"],
    hit_wicket: ["हिट विकेट"],
    run_out: ["रन आउट", "रनआउट"],
    stumped: ["स्टंप", "स्टंप्ड"],
    lbw: ["एलबीडब्ल्यू", "पगबाधा"],
    bowled: ["बोल्ड", "क्लीन बोल्ड"],
    caught: ["लपका", "कैच", "पकड़ा"],
    generic: ["विकेट", "आउट", "गया"],
  },
  "mr-IN": {
    "0": ["धाव नाही", "एकही धाव नाही", "निर्धाव"],
    "1": ["एक धाव"],
    "2": ["दोन धावा", "दोन"],
    "3": ["तीन धावा"],
    "4": ["चौकार", "चार धावा"],
    "5": ["पाच धावा", "पाच"],
    "6": ["षटकार", "सहा धावा", "सहा"],
    run_out: ["धावचीत", "धावबाद"],
    stumped: ["यष्टिचीत"],
    lbw: ["पायचीत"],
    bowled: ["त्रिफळाचीत"],
    caught: ["झेलबाद", "झेल"],
    generic: ["बाद"],
  },
  "ta-IN": {
    "0": ["ரன் இல்லை", "ரன்கள் இல்லை", "டாட் பால்", "டாட்"],
    "1": ["ஒரு ரன்", "ஒன்று", "சிங்கிள்"],
    "2": ["இரண்டு ரன்", "இரண்டு", "டபுள்"],
    "3": ["மூன்று ரன்", "மூன்று"],
    "4": ["நான்கு ரன்", "நான்கு", "ஃபோர்", "போர்", "பவுண்டரி"],
    "5": ["ஐந்து"],
    "6": ["ஆறு ரன்", "ஆறு", "சிக்ஸ்", "சிக்சர்", "சிக்ஸர்"],
    legbye: ["லெக் பை"],
    noball: ["நோ பால்"],
    wide: ["வைடு", "வைட்"],
    bye: ["பை"],
    hit_wicket: ["ஹிட் விக்கெட்"],
    run_out: ["ரன் அவுட்"],
    stumped: ["ஸ்டம்ப்ட்", "ஸ்டம்பிங்"],
    lbw: ["எல்பிடபிள்யூ", "எல் பி டபிள்யூ"],
    bowled: ["போல்ட்", "போல்டு"],
    caught: ["கேட்ச்"],
    generic: ["அவுட்", "விக்கெட்", "ஆட்டமிழந்தார்"],
  },
  "te-IN": {
    "0": ["పరుగులు లేవు", "డాట్ బాల్", "డాట్"],
    "1": ["ఒక పరుగు", "ఒకటి", "సింగిల్"],
    "2": ["రెండు పరుగులు", "రెండు", "డబుల్"],
    "3": ["మూడు పరుగులు", "మూడు"],
    "4": ["నాలుగు పరుగులు", "నాలుగు", "ఫోర్", "బౌండరీ"],
    "5": ["ఐదు"],
    "6": ["ఆరు పరుగులు", "ఆరు", "సిక్స్", "సిక్సర్"],
    legbye: ["లెగ్ బై"],
    noball: ["నో బాల్"],
    wide: ["వైడ్"],
    bye: ["బై"],
    hit_wicket: ["హిట్ వికెట్"],
    run_out: ["రనౌట్", "రన్ అవుట్"],
    stumped: ["స్టంప్డ్", "స్టంపౌట్"],
    lbw: ["ఎల్బీడబ్ల్యూ"],
    bowled: ["బౌల్డ్"],
    caught: ["క్యాచ్"],
    generic: ["అవుట్", "ఔట్", "వికెట్"],
  },
  "kn-IN": {
    "0": ["ರನ್ ಇಲ್ಲ", "ಡಾಟ್ ಬಾಲ್", "ಡಾಟ್"],
    "1": ["ಒಂದು ರನ್", "ಒಂದು", "ಸಿಂಗಲ್"],
    "2": ["ಎರಡು ರನ್", "ಎರಡು", "ಡಬಲ್"],
    "3": ["ಮೂರು ರನ್", "ಮೂರು"],
    "4": ["ನಾಲ್ಕು ರನ್", "ನಾಲ್ಕು", "ಫೋರ್", "ಬೌಂಡರಿ"],
    "5": ["ಐದು"],
    "6": ["ಆರು ರನ್", "ಆರು", "ಸಿಕ್ಸ್", "ಸಿಕ್ಸರ್"],
    legbye: ["ಲೆಗ್ ಬೈ"],
    noball: ["ನೋ ಬಾಲ್"],
    wide: ["ವೈಡ್"],
    bye: ["ಬೈ"],
    hit_wicket: ["ಹಿಟ್ ವಿಕೆಟ್"],
    run_out: ["ರನೌಟ್", "ರನ್ ಔಟ್"],
    stumped: ["ಸ್ಟಂಪ್ಡ್", "ಸ್ಟಂಪ್"],
    lbw: ["ಎಲ್‌ಬಿಡಬ್ಲ್ಯೂ"],
    bowled: ["ಬೌಲ್ಡ್"],
    caught: ["ಕ್ಯಾಚ್"],
    generic: ["ಔಟ್", "ವಿಕೆಟ್"],
  },
  "ml-IN": {
    "0": ["റൺ ഇല്ല", "റൺസ് ഇല്ല", "ഡോട്ട് ബോൾ", "ഡോട്ട്"],
    "1": ["ഒരു റൺ", "ഒന്ന്", "സിംഗിൾ"],
    "2": ["രണ്ട് റൺ", "രണ്ട്", "ഡബിൾ"],
    "3": ["മൂന്ന് റൺ", "മൂന്ന്"],
    "4": ["നാല് റൺ", "നാല്", "ഫോർ", "ബൗണ്ടറി"],
    "5": ["അഞ്ച്"],
    "6": ["ആറ് റൺ", "ആറ്", "സിക്സ്", "സിക്സർ"],
    legbye: ["ലെഗ് ബൈ"],
    noball: ["നോ ബോൾ"],
    wide: ["വൈഡ്"],
    bye: ["ബൈ"],
    hit_wicket: ["ഹിറ്റ് വിക്കറ്റ്"],
    run_out: ["റണ്ണൗട്ട്", "റൺ ഔട്ട്"],
    stumped: ["സ്റ്റംപ്ഡ്", "സ്റ്റംപ്"],
    lbw: ["എൽബിഡബ്ല്യു"],
    bowled: ["ബൗൾഡ്"],
    caught: ["ക്യാച്ച്"],
    generic: ["ഔട്ട്", "വിക്കറ്റ്"],
  },
  "bn-IN": {
    "0": ["কোনো রান নেই", "রান নেই", "ডট বল", "ডট"],
    "1": ["এক রান", "এক", "সিঙ্গেল"],
    "2": ["দুই রান", "দুই", "ডাবল"],
    "3": ["তিন রান", "তিন"],
    "4": ["চার রান", "চার", "ফোর", "বাউন্ডারি"],
    "5": ["পাঁচ"],
    "6": ["ছয় রান", "ছয়", "ছক্কা", "সিক্স"],
    legbye: ["লেগ বাই"],
    noball: ["নো বল"],
    wide: ["ওয়াইড"],
    bye: ["বাই"],
    hit_wicket: ["হিট উইকেট"],
    run_out: ["রান আউট"],
    stumped: ["স্টাম্পড", "স্টাম্প"],
    lbw: ["এলবিডব্লিউ"],
    bowled: ["বোল্ড"],
    caught: ["ক্যাচ"],
    generic: ["আউট", "উইকেট"],
  },
  "gu-IN": {
    "0": ["કોઈ રન નહીં", "ડોટ બોલ", "ડોટ"],
    "1": ["એક રન", "એક", "સિંગલ"],
    "2": ["બે રન", "બે", "ડબલ"],
    "3": ["ત્રણ રન", "ત્રણ"],
    // The Devanagari forms are how Prisma has returned these Gujarati words.
    "4": ["ચાર રન", "ચાર", "ચોગ્ગો", "ચોગ્ગા", "ફોર", "બાઉન્ડરી", "चोग्गो"],
    "5": ["પાંચ"],
    "6": ["છ રન", "છ", "છગ્ગો", "છગ્ગા", "સિક્સ", "छग्गो"],
    legbye: ["લેગ બાય"],
    noball: ["નો બોલ"],
    wide: ["વાઇડ"],
    bye: ["બાય"],
    hit_wicket: ["હિટ વિકેટ"],
    run_out: ["રન આઉટ"],
    stumped: ["સ્ટમ્પ્ડ", "સ્ટમ્પ"],
    lbw: ["એલબીડબલ્યુ"],
    bowled: ["બોલ્ડ"],
    caught: ["કેચ"],
    generic: ["આઉટ", "વિકેટ"],
  },
  "pa-IN": {
    "0": ["ਕੋਈ ਦੌੜ ਨਹੀਂ", "ਡਾਟ ਬਾਲ", "ਡਾਟ"],
    "1": ["ਇੱਕ ਦੌੜ", "ਇੱਕ ਰਨ", "ਇੱਕ", "ਸਿੰਗਲ"],
    "2": ["ਦੋ ਦੌੜਾਂ", "ਦੋ ਰਨ", "ਦੋ", "ਡਬਲ"],
    "3": ["ਤਿੰਨ ਦੌੜਾਂ", "ਤਿੰਨ"],
    "4": ["ਚਾਰ ਦੌੜਾਂ", "ਚੌਕਾ", "ਚਾਰ", "ਫੋਰ", "ਬਾਊਂਡਰੀ"],
    "5": ["ਪੰਜ"],
    "6": ["ਛੇ ਦੌੜਾਂ", "ਛੱਕਾ", "ਛੇ", "ਸਿਕਸ"],
    legbye: ["ਲੈੱਗ ਬਾਈ"],
    noball: ["ਨੋ ਬਾਲ"],
    wide: ["ਵਾਈਡ"],
    bye: ["ਬਾਈ"],
    hit_wicket: ["ਹਿੱਟ ਵਿਕਟ"],
    run_out: ["ਰਨ ਆਊਟ"],
    stumped: ["ਸਟੰਪਡ", "ਸਟੰਪ"],
    lbw: ["ਐਲਬੀਡਬਲਯੂ"],
    bowled: ["ਬੋਲਡ"],
    caught: ["ਕੈਚ"],
    generic: ["ਆਊਟ", "ਵਿਕਟ"],
  },
};

const ALL_WORDS: readonly Words[] = [LATIN, ...Object.values(NATIVE)];

function gather(key: string): string[] {
  return ALL_WORDS.flatMap((w) => w[key] ?? []);
}

function terms(keys: readonly string[]): Term[] {
  return keys.map((value) => ({ value, says: gather(value) }));
}

/**
 * Boundaries first. "ek chauka" and "ஒரு சிக்ஸ்" are "a four" and "a six" in
 * the ordinary way of saying it, so checking 1 before 4 scored them as singles.
 */
export const RUN_TERMS = terms(["6", "4", "0", "1", "2", "3", "5"]);

/** Longer phrases first: "leg bye" has to win before "bye" does. */
export const EXTRA_TERMS = terms(["legbye", "noball", "wide", "bye"]);

export const WICKET_TERMS = terms(["hit_wicket", "run_out", "stumped", "lbw", "bowled", "caught"]);

/**
 * "No run" arrives in mixed scripts: Prisma has returned "रन இல்லை" and
 * "कोई run नहीं" for what was said in one language. So the negative and the word
 * for a run are read separately, whichever script each came back in.
 */
export const RUN_WORDS: readonly string[] = [
  "run", "रन", "धाव", "दौड़", "ரன்", "పరుగు", "ರನ್", "റൺ", "রান", "રન", "ਰਨ", "ਦੌੜ",
];
export const NEGATIVES: readonly string[] = [
  "nahi", "नहीं", "नाही", "இல்லை", "లేదు", "లేవు", "लेवू", "ಇಲ್ಲ", "ഇല്ല", "নেই", "નહીં", "ਨਹੀਂ",
];

/** Said when a wicket falls but not how. The app has to ask. */
export const GENERIC_WICKET: readonly string[] = gather("generic");

const TERM_KEYS = [
  ...RUN_TERMS, ...EXTRA_TERMS, ...WICKET_TERMS,
].map((t) => t.value).concat("generic");

function flatten(words: Words): string[] {
  return TERM_KEYS.flatMap((k) => words[k] ?? []);
}

/**
 * Terms for Prisma's `keyterms`, most useful first.
 *
 * The API takes 200 and the tables hold far more, so the scorer's own language
 * goes first, then Latin (everyone calls some of it in English), then the rest.
 */
export function cricketKeyterms(language?: LanguageCode): string[] {
  const mine = language && language !== "en-IN" ? flatten(NATIVE[language]) : [];
  const rest = Object.values(NATIVE).flatMap(flatten);
  return Array.from(new Set([...mine, ...flatten(LATIN), ...rest]));
}
