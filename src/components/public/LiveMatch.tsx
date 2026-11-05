"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { describeResult, fill } from "@/lib/i18n/result";
import { useT } from "@/lib/i18n/use-language";
import { whatsappLink } from "@/lib/public/client";
import type { PublicMatchView } from "@/lib/public/queries";
import { buildMatch } from "@/lib/scoring/match";
import { InningsCard } from "@/components/stats/InningsCard";
import stats from "@/components/stats/stats.module.css";
import { shortDate, StatusPill } from "./StatusPill";
import styles from "./public.module.css";

const POLL_MS = 10_000;

/** Opens from a WhatsApp link with no install or login, and keeps itself current. */
export function LiveMatch({ initial }: { initial: PublicMatchView }) {
  const t = useT();
  const [view, setView] = useState(initial);
  const [stale, setStale] = useState(false);
  const [removed, setRemoved] = useState(false);
  const live = view.status === "live";

  useEffect(() => {
    if (!live || removed) return;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/public/matches/${initial.code}`, { cache: "no-store" });
        if (res.status === 404) return setRemoved(true);
        if (!res.ok) return setStale(true);
        setView((await res.json()) as PublicMatchView);
        setStale(false);
      } catch {
        setStale(true);
      }
    }
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [initial.code, live, removed]);

  const game = useMemo(() => {
    try {
      return buildMatch(view.payload.setup, view.payload.rules, view.payload.events);
    } catch {
      return null;
    }
  }, [view.payload]);

  const teams = `${view.battingTeam} v ${view.bowlingTeam}`;
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (removed || !game) {
    return (
      <main className={stats.page}>
        <Link href="/discover" className={stats.back}>← {t("findMatches")}</Link>
        <h1 className={stats.title}>{t(removed ? "noLongerPublic" : "scoreUnreadable")}</h1>
        <p className={stats.subtitle}>{t(removed ? "scorerStopped" : "askForLink")}</p>
      </main>
    );
  }

  const current = game.current;
  const chasing = game.phase === "playing" && current.target !== null;
  const need = chasing ? (current.target as number) - current.runs : 0;
  const ballsLeft =
    chasing && current.maxOvers !== null ? current.maxOvers * 6 - current.legalBalls : null;

  return (
    <main className={stats.page}>
      <Link href="/discover" className={stats.back}>← {t("findMatches")}</Link>

      <div className={stats.banner}>
        <div className={styles.cardTop}>
          <h1 className={stats.bannerTitle}>
            {game.result ? describeResult(game.result, t) : teams}
          </h1>
          <StatusPill status={view.status} />
        </div>
        <p className={stats.bannerSub}>
          {game.result ? `${teams} · ` : ""}{view.venue} · {shortDate(view.startedAt)}
        </p>
        {view.tournament && (
          <p className={stats.bannerSub}>
            <Link href={`/t/${view.tournament.code}`} className={styles.fixtureLink}>
              {view.tournament.name}
            </Link>
          </p>
        )}
        {chasing && (
          <p className={stats.bannerSub} role="status">
            {t("target")} {current.target}: {current.battingTeam} ·{" "}
            {ballsLeft !== null
              ? fill(t("needRunsBalls"), { runs: need, balls: ballsLeft })
              : fill(t("needRuns"), { runs: need })}
          </p>
        )}
        <ol className={`${stats.bannerScores} tabular`}>
          {game.innings.map((i) => (
            <li key={i.number}>
              <span>{i.state.battingTeam}</span>
              <strong>{i.state.runs}/{i.state.wickets}{i.state.declared ? "d" : ""}</strong>
            </li>
          ))}
        </ol>
      </div>

      {stale && <p className={styles.note} role="status">{t("couldNotRefresh")}</p>}
      {view.status === "paused" && (
        <p className={styles.note}>{t("scorerQuiet")}</p>
      )}

      <div className={styles.actions}>
        {origin && (
          <a
            className={styles.quiet}
            href={whatsappLink(fill(t("shareTextScore"), { teams, url: `${origin}/m/${view.code}` }))}
            target="_blank"
            rel="noreferrer"
          >
            {t("shareWhatsapp")}
          </a>
        )}
        <Link href="/match/new" className={styles.quiet}>{t("scoreYourOwn")}</Link>
      </div>

      {[...game.innings].reverse().map((entry) => (
        <InningsCard key={entry.number} entry={entry} linkPlayers={false} />
      ))}

      <p className={styles.note}>{t("volunteerNote")}</p>
    </main>
  );
}
