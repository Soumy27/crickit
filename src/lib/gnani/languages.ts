/**
 * The ten languages Prisma and Timbre support.
 *
 * Separate from client.ts because that file is server-only — the setup form
 * needs this list in the browser.
 */
export const LANGUAGES = {
  "hi-IN": "Hindi",
  "mr-IN": "Marathi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "bn-IN": "Bengali",
  "gu-IN": "Gujarati",
  "pa-IN": "Punjabi",
  "en-IN": "English",
} as const;

export type LanguageCode = keyof typeof LANGUAGES;
