/**
 * Lines Prisma v3.0 actually returned in testing, and what the parser made of
 * them.
 *
 * The landing page shows this table as proof, so it lives here rather than in
 * the page: real-output.test.ts runs every row through parseBall and checks
 * the label still comes out. A claim on the page that nothing verifies is a
 * claim that quietly stops being true.
 */

import type { Player } from "@/lib/scoring/types";

/** The squad these clips were recorded against. */
export const DEMO_SQUAD: Player[] = [
  { id: "d1", name: "Rohit", aliases: ["रोहित"] },
  { id: "d2", name: "Imran", aliases: ["इमरान"] },
  { id: "d3", name: "Suresh", aliases: ["सुरेश"] },
];

export interface HeardLine {
  /** Exactly what came back from the speech API. */
  said: string;
  /** What describeBall must produce for it. */
  got: string;
  /** Why this row is interesting. */
  note: string;
}

export const HEARD: readonly HeardLine[] = [
  {
    said: "Rohit ne chauka mara.",
    got: "Four — Rohit",
    note: "Hindi sentence, Latin script, player named",
  },
  {
    said: "छक्का।",
    got: "Six",
    note: "one Devanagari word, no verb",
  },
  {
    said: "Wide गेंद।",
    got: "Wide",
    note: "both scripts in three words",
  },
  {
    said: "दो run।",
    got: "2 runs",
    note: "Devanagari number, English noun",
  },
  {
    said: "कोई रन नहीं",
    got: "Dot ball",
    note: "a negative, which is not a number at all",
  },
  {
    said: "Wicket bowled.",
    got: "Bowled",
    note: "the dismissal named after the wicket",
  },
];
