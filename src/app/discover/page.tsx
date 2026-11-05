"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { scoreLine, StatusPill } from "@/components/public/StatusPill";
import styles from "@/components/public/public.module.css";
import stats from "@/components/stats/stats.module.css";
import { describeResult, fill } from "@/lib/i18n/result";
import type { StringKey } from "@/lib/i18n/strings";
import { useT } from "@/lib/i18n/use-language";
import { LOCATE_MESSAGES, useLocate } from "@/lib/public/client";
import { NEARBY_KM, type Place } from "@/lib/public/geo";
import type { DiscoverMatch, DiscoverTournament } from "@/app/api/discover/route";

interface Results {
  matches: DiscoverMatch[];
  tournaments: DiscoverTournament[];
}

const away = (km: number | null, t: (key: StringKey) => string) => {
  if (km === null) return null;
  return km < 2 ? t("under2Km") : fill(t("kmAway"), { n: Math.round(km) });
};

export default function DiscoverPage() {
  const t = useT();
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
        if (!res.ok) throw new Error(body.error ?? t("searchFailed"));
        setResults(body);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // A dropped connection surfaces as the browser's own English TypeError.
        setError(err instanceof TypeError ? t("searchFailed") : (err as Error).message || t("searchFailed"));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, place, t]);

  const searching = query.trim().length > 0 || place !== null;
  const nothing = results && results.matches.length === 0 && results.tournaments.length === 0;
  const live = results?.matches.filter((m) => m.status === "live") ?? [];
  const others = results?.matches.filter((m) => m.status !== "live") ?? [];
  const locateMessage = LOCATE_MESSAGES[state];

  return (
    <main className={stats.page}>
      <Link href="/" className={stats.back}>← Crickit</Link>
      <div>
        <h1 className={stats.title}>{t("findAMatch")}</h1>
        <p className={stats.subtitle}>{t("discoverHelp")}</p>
      </div>

      <div className={styles.searchBox} role="search">
        <label>
          <span className="visually-hidden">{t("searchPlaceholder")}</span>
          <input
            className={styles.input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
          />
        </label>
        {place ? (
          <button type="button" className={styles.quiet} onClick={() => setPlace(null)}>
            {t("everywhere")}
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
            {t("nearMe")}
          </button>
        )}
      </div>

      {locateMessage && <p className={styles.note} role="status">{t(locateMessage)}</p>}
      {place && (
        <p className={styles.note} role="status">{fill(t("showingWithin"), { n: NEARBY_KM })}</p>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!results && !error && <p className={styles.note} role="status">{t("loading")}</p>}

      {nothing && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            {t(place ? "nothingNearYet" : searching ? "noMatchesFound" : "noPublicMatches")}
          </h2>
          <p className={styles.note}>
            {t(place ? "nothingNearHelp" : "noPublicHelp")}
          </p>
          <div className={styles.actions}>
            <Link href="/match/new" className={styles.action}>{t("scoreAMatch")}</Link>
            <Link href="/tournaments/new" className={styles.quiet}>{t("createATournament")}</Link>
          </div>
        </div>
      )}

      {live.length > 0 && <MatchGroup title={t("liveNow")} matches={live} />}

      {results && results.tournaments.length > 0 && (
        <section aria-labelledby="tournaments-heading">
          <h2 id="tournaments-heading" className={styles.groupTitle}>{t("tournaments")}</h2>
          <ul className={styles.list}>
            {results.tournaments.map((tournament) => (
              <li key={tournament.code}>
                <Link href={`/t/${tournament.code}`} className={styles.card}>
                  <span className={styles.cardTitle}>{tournament.name}</span>
                  <span className={styles.cardMeta}>
                    {[
                      tournament.city,
                      fill(t("teamCount"), { n: tournament.teamCount }),
                      tournament.startsOn && new Date(`${tournament.startsOn}T00:00:00`).toLocaleDateString(),
                      away(tournament.distanceKm, t),
                    ].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && <MatchGroup title={t("recentMatches")} matches={others} />}

      {results && !nothing && (
        <div className={styles.actions}>
          <Link href="/tournaments/new" className={styles.quiet}>{t("createATournament")}</Link>
        </div>
      )}
    </main>
  );
}

function MatchGroup({ title, matches }: { title: string; matches: DiscoverMatch[] }) {
  const t = useT();
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
              <span className={`${styles.cardScore} tabular`}>{m.summary.result ? describeResult(m.summary.result, t) : scoreLine(m.summary, t("notStarted"))}</span>
              <span className={styles.cardMeta}>
                {[m.venue, away(m.distanceKm, t)].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
