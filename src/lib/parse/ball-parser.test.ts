import { describe, expect, it } from "vitest";
import { normalise, parseBall } from "./ball-parser";

const squad = [
  { id: "b1", name: "Rohit" },
  { id: "b2", name: "Imran" },
  { id: "o1", name: "Jadeja" },
];

/** Narrow to a parsed outcome so the tests read cleanly. */
function parsed(said: string, players = squad) {
  const out = parseBall(said, { players });
  if (out.status !== "parsed") {
    throw new Error(`expected "${said}" to parse, got ${out.status}`);
  }
  return out;
}

describe("normalise", () => {
  it("folds case, punctuation and Devanagari digits", () => {
    expect(normalise("Chauka!!  ")).toBe("chauka");
    expect(normalise("४ रन")).toBe("4 रन");
  });
});

describe("runs, as a scorer says them", () => {
  it.each([
    ["dot ball", 0],
    ["khali", 0],
    ["ek run", 1],
    ["single", 1],
    ["do run", 2],
    ["teen", 3],
    ["chauka", 4],
    ["char run", 4],
    ["chhakka", 6],
    ["six", 6],
  ])("reads %s as %i", (said, runs) => {
    expect(parsed(said).event.batRuns).toBe(runs);
  });

  it("reads Devanagari", () => {
    expect(parsed("चौका").event.batRuns).toBe(4);
    expect(parsed("छक्का").event.batRuns).toBe(6);
  });

  it("reads a bare digit, which is what transcribe format returns", () => {
    expect(parsed("4").event.batRuns).toBe(4);
    expect(parsed("२ रन").event.batRuns).toBe(2);
  });

  it("attributes the batter when the squad is known", () => {
    const out = parsed("Rohit ne cover drive mara, chauka");
    expect(out.event.batRuns).toBe(4);
    expect(out.player?.name).toBe("Rohit");
  });

  it("does not match a run word inside a longer word", () => {
    // "done" must not read as "do".
    expect(parseBall("done").status).toBe("unparsed");
  });
});

describe("matching a player across scripts", () => {
  // The experiment in scripts/keyterms-ab.ts found this is the single biggest
  // accuracy problem: a Latin-only squad matched 17% of players even on clean
  // studio audio, because Prisma returns the name in Devanagari about as often
  // as not. Carrying both spellings took it to 100%.
  const bilingual = [
    { id: "b1", name: "Kaustubh", aliases: ["कौस्तुभ"] },
    { id: "b2", name: "Dhananjay", aliases: ["धनंजय"] },
    { id: "b3", name: "Omkar", aliases: ["ओंकार", "ओमकार"] },
  ];

  it("matches the Latin spelling", () => {
    const out = parseBall("Kaustubh ne ek run liya", { players: bilingual });
    if (out.status !== "parsed") throw new Error("did not parse");
    expect(out.player?.name).toBe("Kaustubh");
  });

  it("matches the Devanagari spelling of the same player", () => {
    const out = parseBall("कौस्तुभ ने एक रन लिया।", { players: bilingual });
    if (out.status !== "parsed") throw new Error("did not parse");
    expect(out.player?.name).toBe("Kaustubh");
  });

  it("matches either of several Devanagari spellings", () => {
    for (const said of ["ओंकार ने छक्का मारा", "ओमकार ने छक्का मारा"]) {
      const out = parseBall(said, { players: bilingual });
      if (out.status !== "parsed") throw new Error(`${said} did not parse`);
      expect(out.player?.name).toBe("Omkar");
    }
  });

  it("misses the Devanagari form when the squad is Latin only", () => {
    const latinOnly = bilingual.map(({ id, name }) => ({ id, name }));
    const out = parseBall("कौस्तुभ ने एक रन लिया।", { players: latinOnly });
    if (out.status !== "parsed") throw new Error("did not parse");
    expect(out.player).toBeUndefined();
  });
});

describe("extras", () => {
  it("reads a plain wide", () => {
    const e = parsed("wide").event;
    expect(e.extra).toBe("wide");
    expect(e.extraRuns).toBe(0);
    expect(e.batRuns).toBe(0);
  });

  it("puts runs off a wide into extras, never on the bat", () => {
    const e = parsed("wide do run").event;
    expect(e.extra).toBe("wide");
    expect(e.extraRuns).toBe(2);
    expect(e.batRuns).toBe(0);
  });

  it("reads a no-ball, and runs off it come off the bat", () => {
    const e = parsed("no ball char run").event;
    expect(e.extra).toBe("noball");
    expect(e.batRuns).toBe(4);
  });

  it("prefers leg bye over bye", () => {
    const e = parsed("leg bye ek").event;
    expect(e.extra).toBe("legbye");
    expect(e.extraRuns).toBe(1);
  });

  it("defaults a bye with no number to one run", () => {
    expect(parsed("bye").event.extraRuns).toBe(1);
  });

  it("reads Devanagari extras", () => {
    expect(parsed("वाइड").event.extra).toBe("wide");
  });
});

describe("wickets", () => {
  it.each([
    ["bowled", "bowled"],
    ["clean bowled", "bowled"],
    ["catch out", "caught"],
    ["kaich", "caught"],
    ["lbw", "lbw"],
    ["run out", "run_out"],
    ["stumped", "stumped"],
    ["hit wicket", "hit_wicket"],
  ])("reads %s", (said, kind) => {
    const out = parseBall(said === "kaich" ? "कैच" : said, { players: squad });
    if (out.status !== "parsed") throw new Error(`${said} did not parse`);
    expect(out.event.wicket?.kind).toBe(kind);
  });

  it("takes the striker by default", () => {
    expect(parsed("wicket bowled").event.wicket?.who).toBe("striker");
  });

  it("takes the non-striker only when a run out says so", () => {
    expect(parsed("run out non striker").event.wicket?.who).toBe("non_striker");
  });

  it("asks how, rather than guessing, when only a wicket was heard", () => {
    const out = parseBall("wicket!", { players: squad });
    expect(out.status).toBe("needs_detail");
    if (out.status !== "needs_detail") return;
    expect(out.question).toBe("which_dismissal");
  });

  it("asks the same for a bare Hindi out", () => {
    expect(parseBall("आउट").status).toBe("needs_detail");
  });

  it("reads a run out on a no-ball", () => {
    const e = parsed("no ball run out").event;
    expect(e.extra).toBe("noball");
    expect(e.wicket?.kind).toBe("run_out");
  });
});

describe("confidence", () => {
  it("is high for a clear call", () => {
    expect(parsed("chauka").confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("drops for a long utterance that barely matched", () => {
    const out = parsed(
      "arre yaar pata nahi kya ho raha hai is maidan mein aaj kal ek",
    );
    expect(out.confidence).toBeLessThan(0.7);
  });
});

describe("nothing recognised", () => {
  it("says so rather than inventing a delivery", () => {
    expect(parseBall("").status).toBe("unparsed");
    expect(parseBall("hello how are you").status).toBe("unparsed");
  });

  it("keeps the raw utterance on every parsed event, for the audit trail", () => {
    expect(parsed("chauka").event.said).toBe("chauka");
  });
});

describe("every language Prisma can hear", () => {
  it.each([
    ["चौकार", 4], ["षटकार", 6], ["दोन धावा", 2],
    ["ஃபோர்", 4], ["ஒரு சிக்ஸர்", 6], ["இரண்டு ரன்", 2],
    ["సిక్సర్", 6], ["రెండు పరుగులు", 2],
    ["ಸಿಕ್ಸರ್", 6], ["ಎರಡು ರನ್", 2],
    ["സിക്സർ", 6], ["രണ്ട് റൺ", 2],
    ["ছক্কা", 6], ["ছয় রান", 6], ["দুই রান", 2],
    ["છગ્ગો", 6], ["બે રન", 2],
    ["ਛੱਕਾ", 6], ["ਦੋ ਦੌੜਾਂ", 2],
  ])("%s → %i", (text, runs) => {
    const out = parseBall(text);
    if (out.status !== "parsed") throw new Error(`"${text}" did not parse`);
    expect(out.event.batRuns).toBe(runs);
  });

  it("reads 'a four' as a four, not a single", () => {
    const out = parseBall("Rutvik ne ek chauka mara");
    if (out.status !== "parsed") throw new Error("did not parse");
    expect(out.event.batRuns).toBe(4);
  });

  it("matches a word with or without its joiner", () => {
    const out = parseBall("ಎಲ್‌ಬಿಡಬ್ಲ್ಯೂ");
    if (out.status !== "parsed") throw new Error("did not parse");
    expect(out.event.wicket?.kind).toBe("lbw");
  });
});
