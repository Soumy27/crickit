"use client";

import { useState } from "react";
import { fill } from "@/lib/i18n/result";
import type { StringKey } from "@/lib/i18n/strings";
import { useT } from "@/lib/i18n/use-language";
import { usePublicSync, whatsappLink, type SyncStatus } from "@/lib/public/client";
import type { MatchListing, StoredMatch } from "@/lib/match/store";
import styles from "./public.module.css";

const STATUS_TEXT: Record<SyncStatus, StringKey | null> = {
  idle: null,
  saving: "syncSaving",
  saved: "syncSaved",
  waiting: "syncWaiting",
  gone: "syncGone",
  refused: null,
};

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
  const t = useT();
  const { status, message } = usePublicSync(match, setListing);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const listing = match.listing;
  const teams = `${match.setup.battingTeam} v ${match.setup.bowlingTeam}`;

  if (!listing?.wanted) {
    return (
      <section className={styles.share} aria-label={t("sharing")}>
        <div className={styles.shareRow}>
          <p className={styles.shareText}>{t("privateToPhone")}</p>
          {!confirming && (
            <button type="button" className={styles.shareButton} onClick={() => setConfirming(true)}>
              {t("shareLive")}
            </button>
          )}
        </div>
        {confirming && (
          <>
            <p className={styles.shareText}>{t("sharePrivacyWarning")}</p>
            <div className={styles.shareRow}>
              <button
                type="button"
                className={`${styles.shareButton} ${styles.shareStrong}`}
                onClick={() => {
                  setListing({ wanted: true });
                  setConfirming(false);
                }}
              >
                {t("makePublic")}
              </button>
              <button type="button" className={styles.shareButton} onClick={() => setConfirming(false)}>
                {t("keepPrivate")}
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
      setStopError(fill(t("copyFailed"), { url }));
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
      else setStopError(t("removeFailed"));
    } catch {
      setStopError(t("removeOffline"));
    } finally {
      setStopping(false);
    }
  }

  const statusKey = STATUS_TEXT[status];

  return (
    <section className={styles.share} aria-label={t("sharing")}>
      <p className={styles.shareText} role="status">
        {url ? fill(t("publicAt"), { url: url.replace(/^https?:\/\//, "") }) : t("makingPublic")}
        {status === "refused" ? ` ${message ?? t("listRefused")}` : statusKey ? ` ${t(statusKey)}` : ""}
      </p>
      <div className={styles.shareRow}>
        {url && (
          <>
            <a
              className={`${styles.shareButton} ${styles.shareStrong}`}
              href={whatsappLink(fill(t("shareTextLive"), { teams, url }))}
              target="_blank"
              rel="noreferrer"
            >
              {t("shareWhatsapp")}
            </a>
            <button type="button" className={styles.shareButton} onClick={copy}>
              {t(copied ? "copied" : "copyLink")}
            </button>
          </>
        )}
        <button type="button" className={styles.shareButton} onClick={stop} disabled={stopping}>
          {t(stopping ? "removing" : "stopSharing")}
        </button>
      </div>
      {stopError && <p className={styles.error} role="alert">{stopError}</p>}
    </section>
  );
}
