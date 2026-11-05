/**
 * Guards the proof on the landing page.
 *
 * Every row the page shows has to be a row the parser still produces. If a
 * lexicon change breaks one of these, the page is making a false claim to a
 * judge, which is worse than the regression itself.
 */
import { describe, expect, it } from "vitest";
import { parseBall } from "./ball-parser";
import { DEMO_SQUAD, HEARD } from "./real-output";
import { describeBall } from "@/lib/scoring/describe";

describe("the landing page's transcript table", () => {
  it.each(HEARD.map((h) => [h.said, h.got] as const))(
    "%s → %s",
    (said, got) => {
      const out = parseBall(said, { players: DEMO_SQUAD });
      if (out.status !== "parsed") {
        throw new Error(`"${said}" did not parse (${out.status})`);
      }
      expect(describeBall(out.event, out.player?.name)).toBe(got);
    },
  );
});
