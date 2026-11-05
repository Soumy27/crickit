"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MicButton } from "@/components/scoring/MicButton";
import { useRecorder } from "@/lib/audio/use-recorder";
import { useLanguage } from "@/lib/i18n/use-language";
import { parseBall, type ParseOutcome } from "@/lib/parse/ball-parser";
import { describeBall } from "@/lib/scoring/describe";
import type { BallEvent, Player } from "@/lib/scoring/types";
import styles from "./landing.module.css";

/**
 * Say a ball, watch it land in the book.
 *
 * The demo deliberately does not set up an innings: there is no striker to
 * rotate and no bowler to charge, so a visitor can call six fours in a row
 * without the app asking who came in. It keeps a legal-ball count and a total,
 * which is all the claim needs — the real engine behind /match is the one that
 * knows a wide does not count.
 *
 * Every visitor gets the tap-a-phrase path whether or not they have a
 * microphone, because the parser is the same code either way and a judge on a
 * desktop at midnight should still see the thing work.
 */

/**
 * A demo squad carrying both scripts. Prisma returns "रुत्विक" or "Rutvik"
 * depending on the ball, and a Latin-only list misses half of them — which is
 * the single biggest accuracy finding from the keyterms experiment.
 */
const SQUAD: Player[] = [
  { id: "p1", name: "Rutvik", aliases: ["रुत्विक", "रुतविक"] },
  { id: "p2", name: "Omkar", aliases: ["ओंकार", "ओमकार"] },
  { id: "p3", name: "Kaustubh", aliases: ["कौस्तुभ", "कौस्तुब"] },
  { id: "p4", name: "Sarfaraz", aliases: ["सरफराज", "सर्फराज"] },
];

/** Phrases a visitor can tap. Parsed by the same lexicon, no API call. */
const PHRASES = [
  "Rutvik ne chauka mara",
  "छक्का",
  "Wide गेंद",
  "ஒரு சிக்ஸர்",
  "ছক্কা",
  "Omkar bowled",
];

interface Landed {
  id: number;
  said: string;
  event: BallEvent;
  label: string;
  /** Did this come from the microphone, or from a tapped phrase? */
  heard: boolean;
}

let seq = 0;

export function TryIt() {
  const rec = useRecorder();
  const { language: uiLanguage } = useLanguage();
  const [balls, setBalls] = useState<Landed[]>([]);
  const [miss, setMiss] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The mic is only offered where the browser can actually open one. On plain
  // HTTP from a phone getUserMedia is refused outright, and a dead button is
  // worse than no button.
  const [canRecord, setCanRecord] = useState(false);
  useEffect(() => {
    setCanRecord(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        (window.isSecureContext ?? false),
    );
  }, []);

  const land = useCallback((said: string, outcome: ParseOutcome, heard: boolean) => {
    if (outcome.status === "parsed") {
      setMiss(null);
      setBalls((b) =>
        [
          {
            id: ++seq,
            said,
            event: outcome.event,
            label: describeBall(outcome.event, outcome.player?.name),
            heard,
          },
          ...b,
        ].slice(0, 6),
      );
      return;
    }
    if (outcome.status === "needs_detail") {
      setMiss(
        `Heard “${said}” — a wicket, but not how. In the app it asks: bowled, caught, LBW?`,
      );
      return;
    }
    setMiss(`Heard “${said}”, but no ball in that. Try saying a run or a wicket.`);
  }, []);

  const onStop = useCallback(async () => {
    const { clip, reason } = await rec.stop();
    if (!clip) {
      rec.settle();
      if (reason === "arming") setNote("Mic is on. Now hold it and call a ball.");
      else if (reason === "too_short") setNote("Hold the button while you speak the ball.");
      else if (reason === "unreadable") setNote("That recording would not play back on this browser.");
      return;
    }
    setNote(null);

    const body = new FormData();
    body.append("audio", clip.blob, clip.filename);
    body.append("players", JSON.stringify(SQUAD));
    body.append("hint", uiLanguage);

    try {
      const res = await fetch("/api/stt", { method: "POST", body, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (!res.ok) {
        setNote(
          data?.retry
            ? "The speech API is busy — one call at a time on this key. Try again in a moment."
            : (data?.error ?? "That ball did not get through."),
        );
        return;
      }
      if (!data.transcript) {
        setNote("Nothing came back. Hold the button a little longer.");
        return;
      }
      land(data.transcript, data.parse as ParseOutcome, true);
    } catch {
      setNote("Lost the connection on that one.");
    } finally {
      rec.settle();
    }
  }, [rec, land, uiLanguage]);

  const total = balls.reduce((n, b) => n + b.event.batRuns + b.event.extraRuns, 0);
  const legal = balls.filter((b) => b.event.extra !== "wide" && b.event.extra !== "noball").length;

  return (
    <div className={styles.try}>
      <div className={styles.tryHead}>
        <p className={styles.tryTag}>Your over</p>
        <p className={`${styles.tryScore} tabular`}>
          {total}
          <span className={styles.tryScoreSub}>
            {" "}
            off {legal} {legal === 1 ? "ball" : "balls"}
          </span>
        </p>
      </div>

      {canRecord && (
        <div className={styles.tryMic}>
          <MicButton
            status={rec.status}
            level={rec.level}
            onStart={() => void rec.start()}
            onStop={() => void onStop()}
          />
          <p className={styles.tryHint}>
            Hold, call a ball in any of the ten languages, let go.
          </p>
        </div>
      )}

      <div className={styles.tryChips}>
        <p className={styles.tryChipsLabel}>
          {canRecord ? "Or tap a phrase" : "Tap a phrase"}
        </p>
        <div className={styles.chipRow}>
          {PHRASES.map((p) => (
            <button
              key={p}
              type="button"
              className={styles.chip}
              onClick={() => land(p, parseBall(p, { players: SQUAD }), false)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {(note ?? rec.error) && (
        <p className={styles.tryNote} role="status">
          {note ?? rec.error}
        </p>
      )}
      {miss && (
        <p className={styles.tryMiss} role="status">
          {miss}
        </p>
      )}

      <div className={styles.tryBook} aria-live="polite">
        {balls.length === 0 ? (
          <p className={styles.tryEmpty}>
            Nothing yet. Call a ball and it goes here.
          </p>
        ) : (
          <ul className={styles.tryList}>
            {balls.map((b) => (
              <li key={b.id} className={styles.tryRow}>
                <span className={styles.trySaid}>&ldquo;{b.said}&rdquo;</span>
                <span className={styles.tryLabel}>{b.label}</span>
                <span className={styles.tryMode}>{b.heard ? "heard" : "tapped"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {balls.length >= 2 && (
        <Link href="/match/new" className={styles.tryOn}>
          Score a real match
        </Link>
      )}
    </div>
  );
}
