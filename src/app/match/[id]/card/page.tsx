"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { buildMatch, type MatchState } from "@/lib/scoring/match";
import { describeResult } from "@/lib/i18n/result";
import { loadMatch, type StoredMatch } from "@/lib/match/store";
import { InningsCard } from "@/components/stats/InningsCard";
import styles from "@/components/stats/stats.module.css";
import { useT } from "@/lib/i18n/use-language";

export default function ScorecardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const { id } = use(params);
  const [match, setMatch] = useState<StoredMatch | null | undefined>(undefined);

  useEffect(() => {
    setMatch(loadMatch(id));
  }, [id]);

  if (match === undefined) {
    return <main className={styles.page}><p className={styles.empty}>{t("loading")}</p></main>;
  }
  if (!match) {
    return (
      <main className={styles.page}>
        <Link href="/" className={styles.back}>← Crickit</Link>
        <h1 className={styles.title}>{t("notOnDevice")}</h1>
        <p className={styles.subtitle}>
          {t("storedInBrowser")}
        </p>
      </main>
    );
  }

  let game: MatchState;
  try {
    game = buildMatch(match.setup, match.rules, match.events);
  } catch (err) {
    return (
      <main className={styles.page}>
        <Link href="/" className={styles.back}>← Crickit</Link>
        <h1 className={styles.title}>This scorecard could not be read</h1>
        <p className={styles.subtitle}>{(err as Error).message}</p>
      </main>
    );
  }

  const first = game.innings[0].state;

  return (
    <main className={styles.page}>
      <Link href={`/match/${id}`} className={styles.back}>← {t("backToScoring")}</Link>

      <div className={styles.banner}>
        <h1 className={styles.bannerTitle}>
          {game.result ? describeResult(game.result, t) : `${first.battingTeam} v ${first.bowlingTeam}`}
        </h1>
        <p className={styles.bannerSub}>
          {game.result ? `${first.battingTeam} v ${first.bowlingTeam} · ` : ""}{match.venue} ·{" "}
          {new Date(match.startedAt).toLocaleDateString()}
        </p>
        {(game.result?.dls || game.dls?.revised) && (
          <p className={styles.bannerSub}>{t("dlsNote")}</p>
        )}
        <ol className={`${styles.bannerScores} tabular`}>
          {game.innings.map((i) => (
            <li key={i.number}>
              <span>{i.state.battingTeam}</span>
              <strong>
                {i.state.runs}/{i.state.wickets}{i.state.declared ? "d" : ""}
              </strong>
            </li>
          ))}
        </ol>
      </div>

      {[...game.innings].reverse().map((entry) => (
        <InningsCard key={entry.number} entry={entry} />
      ))}
    </main>
  );
}
