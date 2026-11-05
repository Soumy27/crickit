import { describe, expect, it } from "vitest";
import { cardFigures } from "@/lib/match/careers";
import { BATTING, CAREER, LAST_BALLS, SAMPLE_PLAYERS, TOTAL } from "./sample-match";

describe("the landing page's sample innings", () => {
  it("adds up to its total", () => {
    const runs = BATTING.reduce((n, b) => n + b.runs, 0);
    expect(runs + TOTAL.extras).toBe(TOTAL.runs);
  });

  it("faces exactly the legal balls bowled", () => {
    expect(BATTING.reduce((n, b) => n + b.balls, 0)).toBe(TOTAL.legalBalls);
  });

  it("has as many dismissals as wickets", () => {
    expect(BATTING.filter((b) => !b.notOut).length).toBe(TOTAL.wickets);
  });

  it("gives no batter more boundary runs than runs", () => {
    for (const b of BATTING) expect(b.fours * 4 + b.sixes * 6).toBeLessThanOrEqual(b.runs);
  });

  it("follows the strike ball by ball", () => {
    const other = (who: string) => (who === "Rutvik" ? "Omkar" : "Rutvik");
    let onStrike: string = LAST_BALLS[0].who;
    for (const ball of LAST_BALLS) {
      expect(ball.who).toBe(onStrike);
      if (ball.mark === "1") onStrike = other(onStrike);
      if (ball.over.endsWith(".6") && ball.mark !== "wd") onStrike = other(onStrike);
    }
  });
});

describe("the landing page's sample player cards", () => {
  const [rutvik, sayali] = SAMPLE_PLAYERS;

  it("agrees with Rutvik's page in the scorebook", () => {
    const figures = cardFigures(rutvik);
    const book = Object.fromEntries(CAREER.figures);
    expect(rutvik.matches).toBe(CAREER.matches);
    expect(figures.main).toEqual({ value: book.Runs, label: "runs" });
    expect(Object.fromEntries(figures.rows)).toEqual({
      Average: book.Average,
      "Strike rate": book["Strike rate"],
      Best: book.Best,
      Sixes: book.Sixes,
    });
    expect(rutvik.batting.fifties).toBe(Number(book.Fifties));
  });

  it("leads a bowler's card on wickets, with figures that follow from the totals", () => {
    const figures = cardFigures(sayali);
    expect(figures.main).toEqual({ value: "17", label: "wickets" });
    expect(Object.fromEntries(figures.rows)).toEqual({
      Average: "17.00",
      Economy: "7.81",
      Best: "4/19",
      Overs: "37.0",
    });
  });

  it("treats someone who has only bowled as a bowler, even without a wicket", () => {
    const figures = cardFigures({
      batting: { ...rutvik.batting, innings: 0, runs: 0, balls: 0 },
      bowling: { ...sayali.bowling, wickets: 0, bestWickets: 0 },
    });
    expect(figures.main).toEqual({ value: "0", label: "wickets" });
  });

  it("never shows a recent match better than the career best", () => {
    expect(Math.max(...rutvik.recent.map((m) => m.runs))).toBe(rutvik.batting.best);
    expect(Math.max(...sayali.recent.map((m) => m.wickets))).toBe(sayali.bowling.bestWickets);
  });
});
