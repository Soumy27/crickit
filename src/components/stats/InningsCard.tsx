"use client";

import Link from "next/link";
import { economy, oversString, runRate, strikeRate } from "@/lib/scoring/engine";
import type { InningsEntry } from "@/lib/scoring/match";
import type { InningsState } from "@/lib/scoring/types";
import { careerKey } from "@/lib/match/careers";
import { useT } from "@/lib/i18n/use-language";
import styles from "./stats.module.css";

const DISMISSAL: Record<string, string> = { run_out: "run out" };

function howOut(state: InningsState, id: string): string {
  const b = state.batters[id];
  if (!b.batted) return "did not bat";
  if (!b.out || !b.dismissal) return "not out";
  const { kind, fielder, bowlerId } = b.dismissal;
  // The bowler when it fell, not whoever happens to be bowling now.
  const bowler = bowlerId ? state.bowlers[bowlerId]?.name : undefined;
  const by = bowler ? ` b ${bowler}` : "";
  if (kind === "bowled") return bowler ? `b ${bowler}` : "bowled";
  if (kind === "caught") return `${fielder ? `c ${fielder}` : "caught"}${by}`;
  if (kind === "lbw") return `lbw${by}`;
  if (kind === "stumped") return `${fielder ? `st ${fielder}` : "stumped"}${by}`;
  if (kind === "hit_wicket") return `hit wicket${by}`;
  return fielder ? `run out (${fielder})` : DISMISSAL[kind] ?? kind;
}

/**
 * One innings of a scorecard. Careers live on the scorer's device, so a public
 * page shows the names as plain text rather than links that lead nowhere.
 */
export function InningsCard({ entry, linkPlayers = true }: { entry: InningsEntry; linkPlayers?: boolean }) {
  const t = useT();
  const state = entry.state;
  const extras = state.extras;
  const extrasTotal = extras.wides + extras.noballs + extras.byes + extras.legbyes;
  const batters = entry.setup.batting.map((p) => state.batters[p.id]);
  const bowlers = entry.setup.bowling
    .map((p) => state.bowlers[p.id])
    .filter((b) => b.balls > 0);
  const player = (name: string) =>
    linkPlayers ? <Link href={`/player/${encodeURIComponent(careerKey(name))}`}>{name}</Link> : name;

  return (
    <section className={styles.inningsCard}>
      <div>
        <h2 className={styles.inningsTitle}>
          {state.battingTeam} <span className="tabular">{state.runs}/{state.wickets}{state.declared ? "d" : ""}</span>
        </h2>
        <p className={styles.subtitle}>
          {t("innings")} {entry.number}
          {entry.followOn ? ` · ${t("followOnLabel")}` : ""} · {oversString(state.legalBalls)} {t("overs")} · RR{" "}
          {runRate(state).toFixed(2)}
          {state.target !== null ? ` · ${t("target")} ${state.target}` : ""}
        </p>
      </div>

      <div className={styles.tableScroll}>
        <table className={`${styles.table} tabular`}>
          <caption className="visually-hidden">{t("batting")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("batter")}</th>
              <th scope="col">R</th>
              <th scope="col">B</th>
              <th scope="col">4s</th>
              <th scope="col">6s</th>
              <th scope="col">SR</th>
            </tr>
          </thead>
          <tbody>
            {batters.map((b) => (
              <tr key={b.id}>
                <td>
                  {player(b.name)}
                  <br />
                  <span className={b.batted && !b.out ? `${styles.out} ${styles.notOut}` : styles.out}>
                    {howOut(state, b.id)}
                  </span>
                </td>
                <td className={styles.strong}>{b.batted ? b.runs : "—"}</td>
                <td>{b.batted ? b.balls : "—"}</td>
                <td>{b.batted ? b.fours : "—"}</td>
                <td>{b.batted ? b.sixes : "—"}</td>
                <td>{b.balls > 0 ? strikeRate(b).toFixed(1) : "—"}</td>
              </tr>
            ))}
            <tr>
              <td>
                {t("extras")}
                <br />
                <span className={styles.out}>
                  {extras.wides}w {extras.noballs}nb {extras.byes}b {extras.legbyes}lb
                </span>
              </td>
              <td>{extrasTotal}</td>
              <td colSpan={4} />
            </tr>
            <tr className={styles.totalRow}>
              <td>{t("total")}</td>
              <td>{state.runs}/{state.wickets}</td>
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>

      {bowlers.length === 0 ? (
        <p className={styles.empty}>{t("noOversYet")}</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={`${styles.table} tabular`}>
            <caption className="visually-hidden">{t("bowling")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("bowler")}</th>
                <th scope="col">O</th>
                <th scope="col">M</th>
                <th scope="col">R</th>
                <th scope="col">W</th>
                <th scope="col">Econ</th>
              </tr>
            </thead>
            <tbody>
              {bowlers.map((b) => (
                <tr key={b.id}>
                  <td>{player(b.name)}</td>
                  <td>{oversString(b.balls)}</td>
                  <td>{b.maidens}</td>
                  <td>{b.runs}</td>
                  <td className={styles.strong}>{b.wickets}</td>
                  <td>{economy(b).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className={styles.overs}>
        <summary>{t("overByOver")}</summary>
        <table className={`${styles.table} tabular`}>
          <tbody>
            {state.overs
              .filter((o) => o.marks.length > 0)
              .map((o) => (
                <tr key={o.number}>
                  <td>{t("over")} {o.number}</td>
                  <td className={styles.marks}>{o.marks.map((m) => m.notation).join("  ")}</td>
                  <td>{o.runs}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
