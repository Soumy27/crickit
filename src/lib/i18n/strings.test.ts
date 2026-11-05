/**
 * A missing key falls back to English, which is correct behaviour and also
 * an invisible one: a Kannada scorer would simply meet an English word and
 * assume that is the app. The test is what makes the gap visible here
 * instead of at a ground.
 */
import { describe, expect, it } from "vitest";
import { DICTS, ENGLISH_STRINGS, LANGUAGE_NATIVE, translate } from "./strings";
import { LANGUAGES } from "@/lib/gnani/languages";

const keys = Object.keys(ENGLISH_STRINGS) as (keyof typeof ENGLISH_STRINGS)[];
const codes = Object.keys(LANGUAGES) as (keyof typeof LANGUAGES)[];

describe("the dictionaries", () => {
  it("covers all ten languages the speech models support", () => {
    expect(Object.keys(DICTS).sort()).toEqual([...codes].sort());
    expect(Object.keys(LANGUAGE_NATIVE).sort()).toEqual([...codes].sort());
  });

  it.each(codes)("%s has every string", (code) => {
    const missing = keys.filter((k) => !DICTS[code][k]);
    expect(missing).toEqual([]);
  });

  it.each(codes)("%s has no string left in English by accident", (code) => {
    if (code === "en-IN") return;
    // Cricket words are legitimately the English word in the local script,
    // so this only catches a row copied over verbatim, Latin letters and all.
    const untouched = keys.filter(
      (k) => DICTS[code][k] === ENGLISH_STRINGS[k] && /[A-Za-z]{4}/.test(ENGLISH_STRINGS[k]),
    );
    expect(untouched).toEqual([]);
  });

  it("falls back to English rather than to nothing", () => {
    expect(translate("ta-IN", "runs")).toBe("ஓட்டங்கள்");
    expect(translate("en-IN", "runs")).toBe("Runs");
  });

  it("names each language in its own script", () => {
    expect(LANGUAGE_NATIVE["ta-IN"]).toBe("தமிழ்");
    expect(LANGUAGE_NATIVE["bn-IN"]).toBe("বাংলা");
  });
});
