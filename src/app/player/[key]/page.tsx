"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  battingAverage,
  battingStrikeRate,
  bestBowlingLine,
  bowlingAverage,
  bowlingEconomy,
  careerOvers,
  loadCareers,
  type Career,
} from "@/lib/match/careers";
import { careerInsights } from "@/lib/match/insights";
import { oversString } from "@/lib/scoring/engine";
import pub from "@/components/public/public.module.css";
import styles from "@/components/stats/stats.module.css";
import { fill } from "@/lib/i18n/result";
import { useT } from "@/lib/i18n/use-language";

export default function PlayerPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const t = useT();
  const { key } = use(params);
  const name = decodeURIComponent(key);
  const [career, setCareer] = useState<Career | null | undefined>(undefined);

  useEffect(() => {
    setCareer(loadCareers().find((c) => c.key === name) ?? null);
  }, [name]);

  if (career === undefined) {
    return <main className={styles.page}><p className={styles.empty}>{t("loading")}</p></main>;
  }
  if (career === null) {
    return (
      <main className={styles.page}>
        <Link href="/players" className={styles.back}>← {t("players")}</Link>
        <h1 className={styles.title}>{t("noRecordHere")}</h1>
        <p className={styles.subtitle}>{t("careersFromMatches")}</p>
      </main>
    );
  }

  const avg = battingAverage(career.batting);
  const bowlAvg = bowlingAverage(career.bowling);
  const insights = careerInsights(career, t);

  return (
    <main className={styles.page}>
      <Link href="/players" className={styles.back}>← {t("players")}</Link>

      <div>
        <h1 className={styles.title}>{career.name}</h1>
        <p className={styles.subtitle}>
          {fill(t(career.matches === 1 ? "matchCountOne" : "matchCount"), { n: career.matches })} ·{" "}
          {career.appearances[career.appearances.length - 1]?.venue ?? "—"}
        </p>
      </div>

      {/* The question this page answers: what has he actually done? */}
      <div className={styles.headline}>
        <div className={styles.figure}>
          <span className={`${styles.figureValue} tabular`}>{career.batting.runs}</span>
          <span className={styles.figureLabel}>{t("runs")}</span>
        </div>
        <div className={styles.figure}>
          <span className={`${styles.figureValue} tabular`}>{career.bowling.wickets}</span>
          <span className={styles.figureLabel}>{t("wickets")}</span>
        </div>
        <div className={styles.figure}>
          <span className={`${styles.figureValue} tabular`}>
            {career.batting.innings === 0
              ? "—"
              : `${career.batting.best}${career.batting.bestNotOut ? "*" : ""}`}
          </span>
          <span className={styles.figureLabel}>{t("bestScore")}</span>
        </div>
      </div>

      <section className={styles.inningsCard} aria-labelledby="insights-heading">
        <h2 id="insights-heading" className={styles.inningsTitle}>{t("whatNumbersSay")}</h2>
        {insights.battingForm.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>{t("lastInnings")}</p>
            <ol className={`${pub.form} tabular`}>
              {insights.battingForm.map((score, i) => <li key={i}>{score}</li>)}
            </ol>
          </div>
        )}
        {insights.bowlingForm.length > 0 && (
          <div>
            <p className={styles.sectionLabel}>{t("lastSpells")}</p>
            <ol className={`${pub.form} tabular`}>
              {insights.bowlingForm.map((spell, i) => <li key={i}>{spell}</li>)}
            </ol>
          </div>
        )}
        {insights.notes.length > 0 && (
          <ul className={pub.notes}>
            {insights.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        )}
        {insights.thin && (
          <p className={styles.empty}>{t("thinRecord")}</p>
        )}
      </section>

      <div className={styles.pair}>
        <div>
          <p className={styles.sectionLabel}>{t("batting")}</p>
          <div className={styles.tableScroll}><table className={`${styles.table} tabular`}>
            <tbody>
              <tr><td>{t("innings")}</td><td>{career.batting.innings}</td></tr>
              <tr><td>{t("notOuts")}</td><td>{career.batting.notOuts}</td></tr>
              <tr><td>{t("ballsFaced")}</td><td>{career.batting.balls}</td></tr>
              <tr><td>{t("average")}</td><td>{avg === null ? "—" : avg.toFixed(2)}</td></tr>
              <tr><td>{t("strikeRate")}</td><td>{battingStrikeRate(career.batting).toFixed(1)}</td></tr>
              <tr><td>{t("fours")}</td><td>{career.batting.fours}</td></tr>
              <tr><td>{t("sixes")}</td><td>{career.batting.sixes}</td></tr>
              <tr><td>{t("fifties")}</td><td>{career.batting.fifties}</td></tr>
              <tr><td>{t("hundreds")}</td><td>{career.batting.hundreds}</td></tr>
            </tbody>
          </table></div>
        </div>

        <div>
          <p className={styles.sectionLabel}>{t("bowling")}</p>
          <div className={styles.tableScroll}><table className={`${styles.table} tabular`}>
            <tbody>
              <tr><td>{t("innings")}</td><td>{career.bowling.innings}</td></tr>
              <tr><td>{t("overs")}</td><td>{careerOvers(career.bowling)}</td></tr>
              <tr><td>{t("maidens")}</td><td>{career.bowling.maidens}</td></tr>
              <tr><td>{t("runs")}</td><td>{career.bowling.runs}</td></tr>
              <tr><td>{t("wickets")}</td><td>{career.bowling.wickets}</td></tr>
              <tr><td>{t("average")}</td><td>{bowlAvg === null ? "—" : bowlAvg.toFixed(2)}</td></tr>
              <tr><td>{t("economy")}</td><td>{bowlingEconomy(career.bowling).toFixed(2)}</td></tr>
              <tr><td>{t("best")}</td><td>{bestBowlingLine(career.bowling)}</td></tr>
            </tbody>
          </table></div>
        </div>
      </div>

      <div>
        <p className={styles.sectionLabel}>{t("everyMatch")}</p>
        <div className={styles.tableScroll}><table className={`${styles.table} tabular`}>
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("against")}</th>
              <th>{t("batting")}</th>
              <th>{t("bowling")}</th>
            </tr>
          </thead>
          <tbody>
            {career.appearances.map((a) => (
              <tr key={a.matchId + a.date}>
                <td>
                  <Link href={`/match/${a.matchId}/card`}>
                    {new Date(a.date).toLocaleDateString()}
                  </Link>
                </td>
                <td>{a.opponent}</td>
                <td>
                  {a.batting
                    ? `${a.batting.runs}${a.batting.out ? "" : "*"} (${a.batting.balls})`
                    : "—"}
                </td>
                <td>
                  {a.bowling
                    ? `${oversString(a.bowling.balls)}-${a.bowling.runs}-${a.bowling.wickets}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </main>
  );
}
