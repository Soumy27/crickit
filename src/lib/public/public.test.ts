import { describe, expect, it } from "vitest";
import type { MatchEvent } from "../scoring/types";
import { boundingBox, coarsePlace, distanceKm, validPlace } from "./geo";
import { listingStatus } from "./summary";
import { dayStart, decideVoice, hourStart, limitFromEnv, VOICE_DAILY_DEFAULT, VOICE_HOURLY_DEFAULT } from "./voice-rules";
import { cleanPayload, cleanText, Invalid, likePattern } from "./validate";

const setup = {
  battingTeam: " Shivaji XI ",
  bowlingTeam: "Deccan Club",
  batting: [{ id: "b0", name: "Rutvik" }, { id: "b1", name: "Omkar" }],
  bowling: [{ id: "o0", name: "Dhananjay" }, { id: "o1", name: "Sarfaraz" }],
  strikerId: "b0",
  nonStrikerId: "b1",
  bowlerId: "o0",
  maxOvers: 20,
};

describe("distance", () => {
  it("knows Pune is about 120 km from Mumbai", () => {
    const km = distanceKm({ lat: 19.076, lng: 72.877 }, { lat: 18.52, lng: 73.856 });
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(130);
  });

  it("is zero to the same place", () => {
    expect(distanceKm({ lat: 18.52, lng: 73.85 }, { lat: 18.52, lng: 73.85 })).toBe(0);
  });

  it("boxes in everything inside the radius", () => {
    const centre = { lat: 18.52, lng: 73.85 };
    const box = boundingBox(centre, 50);
    expect(box.minLat).toBeLessThan(18.1);
    expect(box.maxLng).toBeGreaterThan(74.3);
  });

  it("stores a ground to about a kilometre, not to a doorstep", () => {
    expect(coarsePlace({ lat: 18.52043, lng: 73.85674 })).toEqual({ lat: 18.52, lng: 73.86 });
  });

  it("rejects a place that is not on Earth", () => {
    expect(validPlace(91, 10)).toBeNull();
    expect(validPlace(10, 181)).toBeNull();
    expect(validPlace("18", 73)).toBeNull();
    expect(validPlace(Number.NaN, 73)).toBeNull();
    expect(validPlace(18.5, 73.8)).toEqual({ lat: 18.5, lng: 73.8 });
  });
});

describe("what a listing is allowed to say", () => {
  it("cleans text and keeps Indian scripts intact", () => {
    expect(cleanText("  ऋत्विक \n  जाधव\u0000 ", 40)).toBe("ऋत्विक जाधव");
    expect(cleanText(42, 40)).toBe("");
    expect(cleanText("abcdef", 3)).toBe("abc");
  });

  it("works the score out from the balls itself", () => {
    const { summary, payload } = cleanPayload({
      setup,
      events: [
        { type: "ball", batRuns: 4, extraRuns: 0 },
        { type: "ball", batRuns: 6, extraRuns: 0 },
      ],
    });
    expect(payload.setup.battingTeam).toBe("Shivaji XI");
    expect(summary.innings[0]).toMatchObject({ runs: 10, balls: 2, wickets: 0 });
  });

  it("does not publish what the scorer shouted", () => {
    const { payload } = cleanPayload({
      setup,
      events: [{ type: "ball", batRuns: 4, extraRuns: 0, said: "चौका" }],
    });
    expect(payload.events[0]).not.toHaveProperty("said");
  });

  it("does not publish alternative spellings of players' names", () => {
    const { payload } = cleanPayload({
      setup: { ...setup, batting: [{ id: "b0", name: "Rutvik", aliases: ["ऋत्विक"] }, setup.batting[1]] },
      events: [],
    });
    expect(payload.setup.batting[0]).toEqual({ id: "b0", name: "Rutvik" });
  });

  it("refuses a match with no teams, or too few players", () => {
    expect(() => cleanPayload({ setup: { ...setup, battingTeam: "  " }, events: [] })).toThrow(Invalid);
    expect(() => cleanPayload({ setup: { ...setup, batting: [setup.batting[0]] }, events: [] })).toThrow(Invalid);
    expect(() => cleanPayload(null)).toThrow(Invalid);
  });

  it("refuses a log the engine cannot fold", () => {
    expect(() =>
      cleanPayload({ setup: { ...setup, strikerId: "nobody" }, events: [{ type: "ball", batRuns: 1, extraRuns: 0 }] }),
    ).toThrow(Invalid);
  });

  it("takes wildcards in a search literally", () => {
    expect(likePattern("100%_a")).toBe("%100\\%\\_a%");
  });
});

describe("the voice limits", () => {
  const limits = { hourly: 300, daily: 2000 };

  it("lets a call through up to and including the limit", () => {
    expect(decideVoice({ mine: 300, everyone: 2000 }, limits)).toBeNull();
  });

  it("refuses a connection over its hourly limit, without blaming the site", () => {
    expect(decideVoice({ mine: 301, everyone: null }, limits)).toBe("connection");
  });

  it("refuses everyone once the day's allowance is gone", () => {
    expect(decideVoice({ mine: 1, everyone: 2001 }, limits)).toBe("everyone");
  });

  it("has room for a full match from one connection", () => {
    // Twenty overs a side with some extras, over three hours.
    expect(260 / 3).toBeLessThan(VOICE_HOURLY_DEFAULT);
    expect(260).toBeLessThan(VOICE_DAILY_DEFAULT);
  });

  it("starts each window on the hour and the day", () => {
    const now = new Date("2026-11-08T12:34:56.789Z");
    expect(hourStart(now)).toBe("2026-11-08T12:00:00.000Z");
    expect(dayStart(now)).toBe("2026-11-08T00:00:00.000Z");
    expect(now.toISOString()).toBe("2026-11-08T12:34:56.789Z");
  });

  it("ignores a setting that is not a positive whole number", () => {
    expect(limitFromEnv("500", 300)).toBe(500);
    for (const bad of [undefined, "", "0", "-5", "lots", "1.5"]) expect(limitFromEnv(bad, 300)).toBe(300);
  });
});

describe("a chase ended by rain", () => {
  /** Whole overs off the bat, the two bowlers turn and turn about. */
  function overs(count: number, runs: number, bowlers: [string, string]): MatchEvent[] {
    const events: MatchEvent[] = [];
    for (let o = 0; o < count; o++) {
      if (o > 0) events.push({ type: "new_bowler", playerId: bowlers[o % 2] });
      for (let b = 0; b < 6; b++) events.push({ type: "ball", batRuns: runs, extraRuns: 0 });
    }
    return events;
  }

  const short = { ...setup, maxOvers: 10 };
  const rules = { format: "limited" as const };
  // 120 off ten overs, then a chase at a run a ball: behind par after six.
  const played: MatchEvent[] = [
    ...overs(10, 2, ["o0", "o1"]),
    { type: "start_innings", strikerId: "o0", nonStrikerId: "o1", bowlerId: "b0" },
    ...overs(6, 1, ["b0", "b1"]),
    { type: "new_bowler", playerId: "b0" },
  ];

  it("has no par while the chase is still going", () => {
    expect(cleanPayload({ setup: short, rules, events: played }).summary.rainPar).toBeUndefined();
  });

  it("gives back the par the result was decided on", () => {
    const { summary } = cleanPayload({
      setup: short,
      rules,
      events: [...played, { type: "end_match", outcome: "rain" }],
    });
    expect(summary.result).toMatchObject({ kind: "runs", winner: "Shivaji XI", dls: true });
    expect(summary.innings[1].runs).toBe(36);
    expect(summary.rainPar).toBe(36 + (summary.result?.margin ?? 0));
    expect(summary.rainPar).toBeGreaterThan(36);
    expect(summary.rainPar).toBeLessThan(120);
  });
});

describe("a listing's status", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  it("is finished when the match is", () => {
    expect(listingStatus("finished", "2026-11-08T11:59:00Z", now)).toBe("finished");
  });
  it("is live while the scorer is active", () => {
    expect(listingStatus("playing", "2026-11-08T10:00:00Z", now)).toBe("live");
  });
  it("stops claiming to be live when the scorer has gone quiet", () => {
    expect(listingStatus("playing", "2026-11-08T01:00:00Z", now)).toBe("paused");
  });
});
