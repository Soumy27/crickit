"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { rememberTournamentKey, tournamentKey, whatsappLink } from "@/lib/public/client";
import type { TournamentMatchRow, TournamentView } from "@/lib/public/queries";
import { formatNrr, pointsTable, roundRobin } from "@/lib/tournament/table";
import stats from "@/components/stats/stats.module.css";
import { resultLine, scoreLine, shortDate, StatusPill } from "./StatusPill";
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
      <Link href="/discover" className={stats.back}>← Find matches</Link>

      <div className={stats.banner}>
        <h1 className={stats.bannerTitle}>{view.name}</h1>
        <p className={stats.bannerSub}>
          {[
            view.city,
            `${view.overs} ${view.overs === 1 ? "over" : "overs"} a side`,
            `${view.teams.length} teams`,
            view.startsOn && shortDate(`${view.startsOn}T00:00:00+05:30`),
          ].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className={styles.actions}>
        {origin && (
          <a
            className={styles.quiet}
            href={whatsappLink(`${view.name}, table and scores: ${publicUrl}`)}
            target="_blank"
            rel="noreferrer"
          >
            Share on WhatsApp
          </a>
        )}
        {key && (
          <button type="button" className={styles.quiet} onClick={copyScorerLink}>
            {copied ? "Copied" : "Copy scorer link"}
          </button>
        )}
      </div>
      {key && (
        <p className={styles.note}>
          Send the scorer link only to people scoring your matches. Anyone who has it can add results.
        </p>
      )}

      <section aria-labelledby="table-heading">
        <h2 id="table-heading" className={styles.groupTitle}>Points table</h2>
        <div className={stats.tableScroll}>
          <table className={`${styles.table} tabular`}>
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col"><abbr title="Played">P</abbr></th>
                <th scope="col"><abbr title="Won">W</abbr></th>
                <th scope="col"><abbr title="Lost">L</abbr></th>
                <th scope="col"><abbr title="No result">NR</abbr></th>
                <th scope="col"><abbr title="Net run rate">NRR</abbr></th>
                <th scope="col"><abbr title="Points">Pts</abbr></th>
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
        <h2 id="fixtures-heading" className={styles.groupTitle}>Fixtures</h2>
        {rounds.map((games, i) => (
          <div key={i}>
            <p className={`${stats.sectionLabel}`}>Round {i + 1}</p>
            <ul className={styles.list}>
              {games.map(({ home, away }) => {
                const match = matchFor(view.matches, home, away);
                return (
                  <li key={`${home}-${away}`} className={styles.fixtureRow}>
                    <span>
                      <span className={styles.fixtureTeams}>{home} v {away}</span>
                      {match && (
                        <span className={`${styles.cardMeta} tabular`} style={{ display: "block" }}>
                          {resultLine(match.summary) ?? scoreLine(match.summary)}
                        </span>
                      )}
                    </span>
                    {match ? (
                      <span className={styles.placeRow}>
                        <StatusPill status={match.status} />
                        <Link href={`/m/${match.code}`} className={styles.shareButton}>Scorecard</Link>
                      </span>
                    ) : key ? (
                      <Link
                        href={`/match/new?t=${view.code}&a=${encodeURIComponent(home)}&b=${encodeURIComponent(away)}`}
                        className={styles.shareButton}
                      >
                        Score this match
                      </Link>
                    ) : (
                      <span className={styles.cardMeta}>Not started</span>
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
