import { describe, expect, it } from "vitest";
import { parseBall } from "./ball-parser";

/**
 * Golden tests from real Prisma v3.0 output.
 *
 * Every string below came back from the live API on 4 Nov 2026, speaking the
 * same six Hindi utterances through all four output formats. They are here
 * because Prisma's script choice is genuinely unpredictable — the same audio
 * came back as "Rohit ne chauka mara", "छक्का।", "Wide गेंद।" and "2 run" —
 * and the parser has to survive all of it. If a change breaks one of these,
 * it breaks the product on a real ground.
 */

const players = ["Rohit", "Imran", "Suresh", "Jadeja", "Faisal"].map((name, i) => ({
  id: `p${i}`,
  name,
}));

function ball(text: string) {
  const out = parseBall(text, { players });
  if (out.status !== "parsed") throw new Error(`"${text}" did not parse (${out.status})`);
  return out;
}

describe("real Prisma output: four runs", () => {
  it.each([
    "Rohit ne chauka mara.", // transcribe, codemix, transliterate
    "रोहित ने चौका मारा।", // verbatim
  ])("%s", (text) => {
    const out = ball(text);
    expect(out.event.batRuns).toBe(4);
    expect(out.event.extra).toBeUndefined();
  });

  it("attributes Rohit when the name survives in Latin", () => {
    expect(ball("Rohit ne chauka mara.").player?.name).toBe("Rohit");
  });
});

describe("real Prisma output: six", () => {
  it.each(["छक्का।", "chhakka"])("%s", (text) => {
    expect(ball(text).event.batRuns).toBe(6);
  });
});

describe("real Prisma output: wide", () => {
  // Note the mixed script Prisma returns here — Latin "Wide", Devanagari ball.
  it.each(["Wide गेंद।", "Wide ghen."])("%s", (text) => {
    expect(ball(text).event.extra).toBe("wide");
  });
});

describe("real Prisma output: wicket", () => {
  it("reads 'Wicket bowled.' as bowled, not as an unspecified wicket", () => {
    expect(ball("Wicket bowled.").event.wicket?.kind).toBe("bowled");
  });
});

describe("real Prisma output: two runs, written four ways", () => {
  it.each([
    "2 run", // transcribe turns the number into a digit
    "दो run।", // codemix keeps the English word, Devanagari number
    "Do run.", // transliterate romanises everything
    "दो रन", // verbatim stays native
  ])("%s", (text) => {
    expect(ball(text).event.batRuns).toBe(2);
  });
});

describe("real Prisma output: dot ball", () => {
  it.each(["कोई रन नहीं", "Koi run nahi."])("%s", (text) => {
    const out = ball(text);
    expect(out.event.batRuns).toBe(0);
    expect(out.event.wicket).toBeUndefined();
  });
});

describe("real Prisma output: no run, in mixed scripts", () => {
  it.each([
    "कोई run नहीं।",
    "धाव नहीं।",
    "रन இல்லை.",
    "run இல்லை.",
    "पరుగులు लेवू।",
    "कोई दौड़ नहीं।",
  ])("%s", (text) => {
    expect(ball(text).event.batRuns).toBe(0);
  });

  it("does not read a wide with a negative as a dot ball", () => {
    expect(ball("Wide गेंद।").event.extra).toBe("wide");
  });
});

describe("real Prisma output: Gujarati written in Devanagari", () => {
  it.each([["चोग्गो", 4], ["छग्गो", 6]] as const)("%s", (text, runs) => {
    expect(ball(text).event.batRuns).toBe(runs);
  });
});
