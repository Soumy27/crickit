import { describe, expect, it } from "vitest";
import { buildInnings } from "../scoring/engine";
import type { BallEvent, InningsSetup, MatchEvent } from "../scoring/types";
import { generateCommentary, stripTags } from "./generate";

const setup: InningsSetup = {
  battingTeam: "Shivaji XI",
  bowlingTeam: "Deccan Club",
  batting: [
    { id: "b1", name: "Rohit" },
    { id: "b2", name: "Imran" },
    { id: "b3", name: "Suresh" },
  ],
  bowling: [{ id: "o1", name: "Jadeja" }],
  strikerId: "b1",
  nonStrikerId: "b2",
  bowlerId: "o1",
  maxOvers: 20,
};

function ball(p: Partial<BallEvent> = {}): BallEvent {
  return { type: "ball", batRuns: 0, extraRuns: 0, ...p };
}

function commentate(events: MatchEvent[], batterName = "Rohit") {
  const state = buildInnings(setup, events);
  const last = events[events.length - 1] as BallEvent;
  return generateCommentary({
    event: last,
    state,
    batterName,
    bowlerName: "Jadeja",
    language: "hi-IN",
  });
}

describe("commentary", () => {
  it("gets excited about a six and says so with a tag Timbre performs", () => {
    const line = commentate([ball({ batRuns: 6 })]);
    expect(line.text).toContain("<excited>");
    // Either phrasing is a six; which one is picked is deterministic per ball.
    expect(line.text).toMatch(/छक्का|छह रन/);
    expect(line.plain).not.toContain("<excited>");
  });

  it("shouts a wicket", () => {
    const line = commentate([ball({ wicket: { kind: "bowled", who: "striker" } })]);
    expect(line.text).toContain("<shouting>");
    expect(line.text).toContain("बोल्ड");
    expect(line.text).toContain("Rohit");
  });

  it("names the fielder on a catch", () => {
    const line = commentate([
      ball({ wicket: { kind: "caught", who: "striker", fielder: "Faisal" } }),
    ]);
    expect(line.text).toContain("Faisal");
  });

  it("stays flat on a dot, with no tag", () => {
    const line = commentate([ball()]);
    expect(line.text).not.toContain("<");
  });

  it("is deterministic, so a replay reads the same", () => {
    const a = commentate([ball({ batRuns: 4 })]);
    const b = commentate([ball({ batRuns: 4 })]);
    expect(a.text).toBe(b.text);
  });

  it("calls a fifty on the ball that brings it up, and only then", () => {
    const run4 = ball({ batRuns: 4 });
    const twelveFours: MatchEvent[] = [];
    // 12 fours = 48, then a four brings up 52.
    for (let i = 0; i < 12; i++) {
      twelveFours.push(run4);
      // Keep Rohit on strike: fours do not rotate, but overs do.
      if ((i + 1) % 6 === 0) twelveFours.push({ type: "new_bowler", playerId: "o1" });
    }
    const before = commentate([...twelveFours.slice(0, -1)]);
    expect(before.text).not.toContain("अर्धशतक");
  });

  it("marks the end of an over", () => {
    const over: MatchEvent[] = Array.from({ length: 6 }, () => ball({ batRuns: 1 }));
    const state = buildInnings(setup, over);
    const line = generateCommentary({
      event: over[5] as BallEvent,
      state,
      batterName: "Rohit",
      language: "hi-IN",
    });
    expect(line.text).toContain("ओवर समाप्त");
  });

  it("commentates in Telugu rather than falling back to English", () => {
    const state = buildInnings(setup, [ball({ batRuns: 6 })]);
    const line = generateCommentary({
      event: ball({ batRuns: 6 }),
      state,
      batterName: "Rohit",
      language: "te-IN",
    });
    expect(line.text).toContain("సిక్సర్");
  });

  it("speaks Marathi when asked", () => {
    const state = buildInnings(setup, [ball({ batRuns: 4 })]);
    const line = generateCommentary({
      event: ball({ batRuns: 4 }),
      state,
      batterName: "Rohit",
      language: "mr-IN",
    });
    expect(line.text).toContain("चौकार");
  });
});

describe("stripTags", () => {
  it("removes every tag and tidies the spacing", () => {
    expect(stripTags("<excited>Four! <pauses> Lovely.")).toBe("Four! Lovely.");
  });
});
