"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { resultLine, scoreLine, StatusPill } from "@/components/public/StatusPill";
import styles from "@/components/public/public.module.css";
import stats from "@/components/stats/stats.module.css";
import { LOCATE_MESSAGES, useLocate } from "@/lib/public/client";
import { NEARBY_KM, type Place } from "@/lib/public/geo";
import type { DiscoverMatch, DiscoverTournament } from "@/app/api/discover/route";

interface Results {
  matches: DiscoverMatch[];
  tournaments: DiscoverTournament[];
}

const away = (km: number | null) => {
  if (km === null) return null;
  return km < 2 ? "Under 2 km away" : `${Math.round(km)} km away`;
};

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { locate, state } = useLocate();
  const latestRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      latestRequest.current?.abort();
      const controller = new AbortController();
      latestRequest.current = controller;
      setError(null);
      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: query, ...place }),
          signal: controller.signal,
        });
        const body = (await res.json()) as Results & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Search failed.");
        setResults(body);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Search failed. Check your signal and try again.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, place]);

  const searching = query.trim().length > 0 || place !== null;
  const nothing = results && results.matches.length === 0 && results.tournaments.length === 0;
  const live = results?.matches.filter((m) => m.status === "live") ?? [];
  const others = results?.matches.filter((m) => m.status !== "live") ?? [];

  return (
    <main className={stats.page}>
      <Link href="/" className={stats.back}>← Crickit</Link>
      <div>
        <h1 className={stats.title}>Find a match</h1>
        <p className={stats.subtitle}>
          Matches and tournaments their scorers have chosen to make public.
        </p>
      </div>

      <div className={styles.searchBox} role="search">
        <label>
          <span className="visually-hidden">Team, ground, town or tournament</span>
          <input
            className={styles.input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Team, ground, town or tournament"
            autoComplete="off"
          />
        </label>
        {place ? (
          <button type="button" className={styles.quiet} onClick={() => setPlace(null)}>
            Everywhere
          </button>
        ) : (
          <button
            type="button"
            className={styles.action}
            disabled={state === "locating"}
            onClick={async () => {
              const found = await locate();
              if (found) setPlace(found);
            }}
          >
            Near me
          </button>
        )}
      </div>

      {LOCATE_MESSAGES[state] && <p className={styles.note} role="status">{LOCATE_MESSAGES[state]}</p>}
      {place && (
        <p className={styles.note} role="status">
          Showing within {NEARBY_KM} km. Your location is used for this search only and is not saved.
        </p>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!results && !error && <p className={styles.note} role="status">Loading…</p>}

      {nothing && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            {place ? "Nothing near you yet" : searching ? "No matches found" : "No public matches yet"}
          </h2>
          <p className={styles.note}>
            {place
              ? "Only matches with a ground location show up here. Try searching your town by name, or put your ground on the map."
              : "Score a match and share it, and it will show up here for anyone looking."}
          </p>
          <div className={styles.actions}>
            <Link href="/match/new" className={styles.action}>Score a match</Link>
            <Link href="/tournaments/new" className={styles.quiet}>Create a tournament</Link>
          </div>
        </div>
      )}

      {live.length > 0 && <MatchGroup title="Live now" matches={live} />}

      {results && results.tournaments.length > 0 && (
        <section aria-labelledby="tournaments-heading">
          <h2 id="tournaments-heading" className={styles.groupTitle}>Tournaments</h2>
          <ul className={styles.list}>
            {results.tournaments.map((t) => (
              <li key={t.code}>
                <Link href={`/t/${t.code}`} className={styles.card}>
                  <span className={styles.cardTitle}>{t.name}</span>
                  <span className={styles.cardMeta}>
                    {[
                      t.city,
                      `${t.teamCount} teams`,
                      t.startsOn && new Date(`${t.startsOn}T00:00:00`).toLocaleDateString(),
                      away(t.distanceKm),
                    ].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && <MatchGroup title="Recent matches" matches={others} />}

      {results && !nothing && (
        <div className={styles.actions}>
          <Link href="/tournaments/new" className={styles.quiet}>Create a tournament</Link>
        </div>
      )}
    </main>
  );
}

function MatchGroup({ title, matches }: { title: string; matches: DiscoverMatch[] }) {
  return (
    <section aria-label={title}>
      <h2 className={styles.groupTitle}>{title}</h2>
      <ul className={styles.list}>
        {matches.map((m) => (
          <li key={m.code}>
            <Link href={`/m/${m.code}`} className={styles.card}>
              <span className={styles.cardTop}>
                <span className={styles.cardTitle}>{m.battingTeam} v {m.bowlingTeam}</span>
                <StatusPill status={m.status} />
              </span>
              <span className={`${styles.cardScore} tabular`}>{resultLine(m.summary) ?? scoreLine(m.summary)}</span>
              <span className={styles.cardMeta}>
                {[m.venue, away(m.distanceKm)].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
