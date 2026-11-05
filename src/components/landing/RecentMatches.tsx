"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listMatches, type MatchSummary } from "@/lib/match/store";
import styles from "./landing.module.css";

/**
 * Matches saved on this device.
 *
 * Renders nothing at all until it has looked, and nothing afterwards if there
 * are none: a first-time visitor should not meet an empty box on a landing
 * page telling them what they have not done yet.
 */
export function RecentMatches() {
  const [matches, setMatches] = useState<MatchSummary[] | null>(null);

  useEffect(() => {
    setMatches(listMatches());
  }, []);

  if (!matches?.length) return null;

  return (
    <section className={styles.recent} aria-labelledby="recent-heading">
      <h2 id="recent-heading" className={styles.recentTitle}>
        On this device
      </h2>
      <ul className={styles.recentList}>
        {matches.map((m) => (
          <li key={m.id}>
            <Link href={`/match/${m.id}`} className={styles.recentItem}>
              <span className={styles.recentTeams}>
                {m.battingTeam} v {m.bowlingTeam}
              </span>
              <span className={styles.recentMeta}>
                {m.venue} · {new Date(m.startedAt).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
