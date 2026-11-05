/**
 * The made-up innings the landing page's scorebook shows.
 *
 * It lives in one place and a test adds it up, because the page says the card
 * reconciles and a sample that does not would be a lie told in figures. The
 * ball list also follows the strike: odd runs swap ends, and so does the over.
 */

export const TEAM = "Shivaji Park XI";
export const TOTAL = { runs: 84, wickets: 2, overs: "9.4", legalBalls: 58, extras: 4 };

export const LAST_BALLS = [
  { over: "8.4", who: "Omkar", said: "एक रन", mark: "1" },
  { over: "8.5", who: "Rutvik", said: "वाइड गेंद", mark: "wd" },
  { over: "8.5", who: "Rutvik", said: "कोई रन नहीं", mark: "·" },
  { over: "8.6", who: "Rutvik", said: "एक रन", mark: "1" },
  { over: "9.1", who: "Rutvik", said: "चौका", mark: "4" },
  { over: "9.2", who: "Rutvik", said: "कोई रन नहीं", mark: "·" },
  { over: "9.3", who: "Rutvik", said: "एक रन", mark: "1" },
  { over: "9.4", who: "Omkar", said: "छक्का", mark: "6" },
] as const;

export const BATTING = [
  { name: "Rutvik Jadhav", runs: 41, notOut: true, balls: 28, fours: 5, sixes: 1 },
  { name: "Omkar Patil", runs: 22, notOut: true, balls: 14, fours: 1, sixes: 2 },
  { name: "Kaustubh Rane", runs: 13, notOut: false, balls: 10, fours: 2, sixes: 0 },
  { name: "Sarfaraz Shaikh", runs: 4, notOut: false, balls: 6, fours: 0, sixes: 0 },
] as const;

export const CAREER = {
  name: "Rutvik Jadhav",
  matches: 14,
  figures: [
    ["Runs", "412"],
    ["Average", "34.33"],
    ["Strike rate", "131.2"],
    ["Best", "68*"],
    ["Fifties", "3"],
    ["Sixes", "19"],
  ],
} as const;

/**
 * The two filled player cards. Raw career totals, so the figures on the card are
 * worked out by the same code the real player pages use. Rutvik's must agree
 * with his page in the scorebook above, and a test holds them together.
 */
export const SAMPLE_PLAYERS = [
  {
    name: "Rutvik Jadhav",
    team: TEAM,
    matches: CAREER.matches,
    batting: {
      innings: 14, runs: 412, balls: 314, fours: 31, sixes: 19,
      notOuts: 2, best: 68, bestNotOut: true, fifties: 3, hundreds: 0,
    },
    bowling: {
      innings: 2, balls: 24, runs: 38, wickets: 1, maidens: 0,
      bestWickets: 1, bestRuns: 17,
    },
    recent: [
      { opponent: "Kalyan Colts", line: "41* (28)", runs: 41 },
      { opponent: "Mill Road CC", line: "68* (39)", runs: 68 },
      { opponent: "Deccan Club", line: "9 (11)", runs: 9 },
    ],
  },
  {
    name: "Sayali Kulkarni",
    team: "Deccan Club",
    matches: 11,
    batting: {
      innings: 6, runs: 47, balls: 52, fours: 4, sixes: 0,
      notOuts: 3, best: 18, bestNotOut: true, fifties: 0, hundreds: 0,
    },
    bowling: {
      innings: 11, balls: 222, runs: 289, wickets: 17, maidens: 2,
      bestWickets: 4, bestRuns: 19,
    },
    recent: [
      { opponent: "Shivaji Park XI", line: "3/24 (4 overs)", wickets: 3 },
      { opponent: "Kalyan Colts", line: "4/19 (4 overs)", wickets: 4 },
      { opponent: "Mill Road CC", line: "1/31 (4 overs)", wickets: 1 },
    ],
  },
] as const;
