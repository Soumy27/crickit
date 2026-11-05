"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { describeResult, fill } from "@/lib/i18n/result";
import { useT } from "@/lib/i18n/use-language";
import { rememberTournamentKey, tournamentKey, whatsappLink } from "@/lib/public/client";
import type { TournamentMatchRow, TournamentView } from "@/lib/public/queries";
import { formatNrr, pointsTable, roundRobin } from "@/lib/tournament/table";
import stats from "@/components/stats/stats.module.css";
import { scoreLine, shortDate, StatusPill } from "./StatusPill";
import styles from "./public.module.css";

const POLL_MS = 30_000;

/** A pair has played if there is a match between them, whichever side batted first. */
function matchFor(matches: readonly TournamentMatchRow[], a: string, b: string) {
  return [...matches]
    .reverse()
    .find(
      (m) =>
        (m.battingTeam === a && m.bowlingTeam === b) ||
        (m.battingTeam === b && m.bowlingTeam === a),
    );
}

export function TournamentBoard({ initial }: { initial: TournamentView }) {
  const t = useT();
  const [view, setView] = useState(initial);
  const [key, setKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    // A scorer link carries the key after the #, so it never reaches a server log.
    const fromLink = new URLSearchParams(window.location.hash.slice(1)).get("key");
    if (fromLink) {
      rememberTournamentKey(initial.code, fromLink);
      window.history.replaceState(null, "", window.location.pathname);
    }
    setKey(fromLink ?? tournamentKey(initial.code));
  }, [initial.code]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/tournaments/${initial.code}`, { cache: "no-store" });
        if (res.ok) setView((await res.json()) as TournamentView);
      } catch {
        // Keep showing what we have; the next tick tries again.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [initial.code]);

  const table = useMemo(
    () => pointsTable(view.teams, view.matches.map((m) => m.summary)),
    [view.teams, view.matches],
  );
  const rounds = useMemo(() => roundRobin(view.teams), [view.teams]);
  const publicUrl = `${origin}/t/${view.code}`;

  async function copyScorerLink() {
    await navigator.clipboard.writeText(`${publicUrl}#key=${key}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className={stats.page}>
      <Link href="/discover" className={stats.back}>← {t("findMatches")}</Link>

      <div className={stats.banner}>
        <h1 className={stats.bannerTitle}>{view.name}</h1>
        <p className={stats.bannerSub}>
          {[
            view.city,
            fill(t(view.overs === 1 ? "overASideOne" : "oversASideCount"), { n: view.overs }),
            fill(t("teamCount"), { n: view.teams.length }),
            view.startsOn && shortDate(`${view.startsOn}T00:00:00+05:30`),
          ].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className={styles.actions}>
        {origin && (
          <a
            className={styles.quiet}
            href={whatsappLink(fill(t("shareTextTable"), { name: view.name, url: publicUrl }))}
            target="_blank"
            rel="noreferrer"
          >
            {t("shareWhatsapp")}
          </a>
        )}
        {key && (
          <button type="button" className={styles.quiet} onClick={copyScorerLink}>
            {t(copied ? "copied" : "copyScorerLink")}
          </button>
        )}
      </div>
      {key && (
        <p className={styles.note}>{t("scorerLinkNote")}</p>
      )}

      <section aria-labelledby="table-heading">
        <h2 id="table-heading" className={styles.groupTitle}>{t("pointsTable")}</h2>
        <div className={stats.tableScroll}>
          <table className={`${styles.table} tabular`}>
            <thead>
              <tr>
                <th scope="col">{t("team")}</th>
                <th scope="col"><abbr title={t("played")}>P</abbr></th>
                <th scope="col"><abbr title={t("won")}>W</abbr></th>
                <th scope="col"><abbr title={t("lost")}>L</abbr></th>
                <th scope="col"><abbr title={t("noResult")}>NR</abbr></th>
                <th scope="col"><abbr title={t("netRunRate")}>NRR</abbr></th>
                <th scope="col"><abbr title={t("points")}>Pts</abbr></th>
              </tr>
            </thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.team}>
                  <td>{row.team}</td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.lost}</td>
                  <td>{row.noResult}</td>
                  <td>{formatNrr(row.nrr)}</td>
                  <td className={styles.points}>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="fixtures-heading">
        <h2 id="fixtures-heading" className={styles.groupTitle}>{t("fixtures")}</h2>
        {rounds.map((games, i) => (
          <div key={i}>
            <p className={`${stats.sectionLabel}`}>{fill(t("round"), { n: i + 1 })}</p>
            <ul className={styles.list}>
              {games.map(({ home, away }) => {
                const match = matchFor(view.matches, home, away);
                return (
                  <li key={`${home}-${away}`} className={styles.fixtureRow}>
                    <span>
                      <span className={styles.fixtureTeams}>{home} v {away}</span>
                      {match && (
                        <span className={`${styles.cardMeta} tabular`} style={{ display: "block" }}>
                          {match.summary.result
                            ? describeResult(match.summary.result, t)
                            : scoreLine(match.summary, t("notStarted"))}
                        </span>
                      )}
                    </span>
                    {match ? (
                      <span className={styles.placeRow}>
                        <StatusPill status={match.status} />
                        <Link href={`/m/${match.code}`} className={styles.shareButton}>{t("scorecard")}</Link>
                      </span>
                    ) : key ? (
                      <Link
                        href={`/match/new?t=${view.code}&a=${encodeURIComponent(home)}&b=${encodeURIComponent(away)}`}
                        className={styles.shareButton}
                      >
                        {t("scoreThisMatch")}
                      </Link>
                    ) : (
                      <span className={styles.cardMeta}>{t("notStarted")}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
