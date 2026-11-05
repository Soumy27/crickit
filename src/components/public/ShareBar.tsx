"use client";

import { useState } from "react";
import { usePublicSync, whatsappLink } from "@/lib/public/client";
import type { MatchListing, StoredMatch } from "@/lib/match/store";
import styles from "./public.module.css";

const STATUS_TEXT = {
  idle: "",
  saving: "Updating…",
  saved: "Public score is up to date.",
  waiting: "No signal. Scoring is safe; the public score catches up when you are back online.",
  gone: "This match was removed from the public list.",
  refused: "",
} as const;

/**
 * The opt-in, on the scoring screen as well as the setup form, since a scorer
 * often only decides to share once the match is under way.
 */
export function ShareBar({
  match,
  setListing,
}: {
  match: StoredMatch;
  setListing: (listing: MatchListing | undefined) => void;
}) {
  const { status, message } = usePublicSync(match, setListing);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const listing = match.listing;
  const teams = `${match.setup.battingTeam} v ${match.setup.bowlingTeam}`;

  if (!listing?.wanted) {
    return (
      <section className={styles.share} aria-label="Sharing">
        <div className={styles.shareRow}>
          <p className={styles.shareText}>Private to this phone.</p>
          {!confirming && (
            <button type="button" className={styles.shareButton} onClick={() => setConfirming(true)}>
              Share live
            </button>
          )}
        </div>
        {confirming && (
          <>
            <p className={styles.shareText}>
              Anyone with the link, or searching, will see the teams, ground, score and every
              player&rsquo;s name. Get the players&rsquo; OK first, and a parent&rsquo;s for children.
            </p>
            <div className={styles.shareRow}>
              <button
                type="button"
                className={`${styles.shareButton} ${styles.shareStrong}`}
                onClick={() => {
                  setListing({ wanted: true });
                  setConfirming(false);
                }}
              >
                Make this match public
              </button>
              <button type="button" className={styles.shareButton} onClick={() => setConfirming(false)}>
                Keep it private
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  const url = listing.code ? `${window.location.origin}/m/${listing.code}` : null;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStopError(`Could not copy. The link is ${url}`);
    }
  }

  async function stop() {
    setStopError(null);
    if (!listing?.code) {
      setListing(undefined);
      return;
    }
    setStopping(true);
    try {
      const res = await fetch(`/api/public/matches/${listing.code}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${listing.token}` },
      });
      // Already gone is the outcome being asked for.
      if (res.ok || res.status === 404) setListing(undefined);
      else setStopError("Could not remove it yet. Check your signal and try again.");
    } catch {
      setStopError("No signal, so it is still public. Try again when you are back online.");
    } finally {
      setStopping(false);
    }
  }

  return (
    <section className={styles.share} aria-label="Sharing">
      <p className={styles.shareText} role="status">
        {url ? `Public at ${url.replace(/^https?:\/\//, "")}` : "Making it public…"}
        {status === "refused" ? ` ${message ?? ""}` : ` ${STATUS_TEXT[status]}`}
      </p>
      <div className={styles.shareRow}>
        {url && (
          <>
            <a
              className={`${styles.shareButton} ${styles.shareStrong}`}
              href={whatsappLink(`${teams}, live score: ${url}`)}
              target="_blank"
              rel="noreferrer"
            >
              Share on WhatsApp
            </a>
            <button type="button" className={styles.shareButton} onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </>
        )}
        <button type="button" className={styles.shareButton} onClick={stop} disabled={stopping}>
          {stopping ? "Removing…" : "Stop sharing"}
        </button>
      </div>
      {stopError && <p className={styles.error} role="alert">{stopError}</p>}
    </section>
  );
}
