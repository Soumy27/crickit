import type { ListingStatus } from "@/lib/public/summary";
import type { PublicSummary } from "@/lib/public/summary";
import { oversString } from "@/lib/scoring/engine";
import styles from "./public.module.css";

const LABEL: Record<ListingStatus, string> = { live: "Live", paused: "Paused", finished: "Finished" };

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/**
 * One fixed locale and zone, because these pages render on the server first: a
 * date in the visitor's own format would differ from the server's and break hydration.
 */
export function shortDate(value: string): string {
  return DATE.format(new Date(value));
}

export function StatusPill({ status }: { status: ListingStatus }) {
  return <span className={styles.status} data-status={status}>{LABEL[status]}</span>;
}

/** "Shivaji XI 84/2 (9.4)", innings by innings, or a plain "Not started". */
export function scoreLine(summary: PublicSummary): string {
  const played = summary.innings.filter((i) => i.balls > 0 || i.runs > 0);
  if (played.length === 0) return "Not started";
  return played.map((i) => `${i.team} ${i.runs}/${i.wickets} (${oversString(i.balls)})`).join(" · ");
}

/** The result in plain words, for places with no language context on the server. */
export function resultLine(summary: PublicSummary): string | null {
  const { result } = summary;
  if (!result) return null;
  const s = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const dls = result.dls ? " (DLS)" : "";
  switch (result.kind) {
    case "runs":
      return `${result.winner} won by ${s(result.margin, "run")}${dls}`;
    case "wickets":
      return `${result.winner} won by ${s(result.margin, "wicket")}${dls}`;
    case "innings":
      return `${result.winner} won by an innings and ${s(result.margin, "run")}`;
    case "tie":
      return `Match tied${dls}`;
    case "draw":
      return "Match drawn";
    case "abandoned":
      return "Abandoned, no result";
  }
}
