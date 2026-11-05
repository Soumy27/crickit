"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  battingAverage,
  bestBowlingLine,
  careerOvers,
  loadCareers,
  type Career,
} from "@/lib/match/careers";
import styles from "@/components/stats/stats.module.css";
import { useT } from "@/lib/i18n/use-language";

export default function PlayersPage() {
  const t = useT();
  const [careers, setCareers] = useState<Career[] | null>(null);

  useEffect(() => {
    setCareers(loadCareers());
  }, []);

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>← Crickit</Link>
      <div>
        <h1 className={styles.title}>{t("players")}</h1>
        <p className={styles.subtitle}>{t("everyCareer")}</p>
      </div>

      {careers === null ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : careers.length === 0 ? (
        <p className={styles.empty}>
          {t("noPlayersYet")}
        </p>
      ) : (
        <div className={styles.tableScroll}>
        <table className={`${styles.table} tabular`}>
          <thead>
            <tr>
              <th>{t("player")}</th>
              <th>M</th>
              <th>{t("runs")}</th>
              <th>HS</th>
              <th>{t("average")}</th>
              <th>{t("overs")}</th>
              <th>{t("wickets")}</th>
              <th>{t("best")}</th>
            </tr>
          </thead>
          <tbody>
            {careers.map((c) => {
              const avg = battingAverage(c.batting);
              return (
                <tr key={c.key}>
                  <td>
                    <Link href={`/player/${encodeURIComponent(c.key)}`}>{c.name}</Link>
                  </td>
                  <td>{c.matches}</td>
                  <td>{c.batting.runs}</td>
                  <td>
                    {c.batting.innings === 0
                      ? "—"
                      : `${c.batting.best}${c.batting.bestNotOut ? "*" : ""}`}
                  </td>
                  <td>{avg === null ? "—" : avg.toFixed(1)}</td>
                  <td>{c.bowling.balls === 0 ? "—" : careerOvers(c.bowling)}</td>
                  <td>{c.bowling.wickets}</td>
                  <td>{bestBowlingLine(c.bowling)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </main>
  );
}
