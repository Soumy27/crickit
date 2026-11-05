import type { MatchResult } from "@/lib/scoring/match";
import type { StringKey } from "./strings";

type T = (key: StringKey) => string;

/** Fills {name} slots in a translated string. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

/** One line for the result, in the app's language. */
export function describeResult(result: MatchResult, t: T): string {
  return result.dls ? `${resultLine(result, t)} (DLS)` : resultLine(result, t);
}

function resultLine(result: MatchResult, t: T): string {
  const values = { team: result.winner ?? "", n: result.margin };
  switch (result.kind) {
    case "runs":
      return fill(t("wonByRuns"), values).replace(/\b1 runs\b/, "1 run");
    case "wickets":
      return fill(t("wonByWickets"), values).replace(/\b1 wickets\b/, "1 wicket");
    case "innings":
      return fill(t("wonByInnings"), values).replace(/\b1 runs\b/, "1 run");
    case "tie":
      return t("matchTied");
    case "draw":
      return t("matchDrawn");
    case "abandoned":
      return `${t("matchAbandoned")}. ${t("noResult")}`;
  }
}
