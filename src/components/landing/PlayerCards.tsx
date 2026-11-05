"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cardFigures, careerKey, loadCareers, type Career } from "@/lib/match/careers";
import { SAMPLE_PLAYERS } from "./sample-match";
import styles from "./landing.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const BLANK_ROWS = [["Average", "—"], ["Strike rate", "—"], ["Best", "—"], ["Sixes", "—"]] as const;

/**
 * Two filled cards and one with your name on it, dealt from a single pile as the
 * section arrives. The dealing is only ever a `from`: the cards' resting places
 * are plain CSS, so the deck is all there if the script never runs.
 */
export function PlayerCards() {
  const deck = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.from(`.${styles.cardSlot}`, {
          xPercent: (i) => (1 - i) * 104,
          y: 56,
          rotation: 0,
          duration: 0.9,
          stagger: 0.07,
          ease: "power3.out",
          scrollTrigger: { trigger: deck.current, start: "top 78%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: deck },
  );

  return (
    <ul className={styles.cardDeck} ref={deck}>
      {SAMPLE_PLAYERS.map((player) => (
        <li key={player.name} className={styles.cardSlot}>
          <SampleCard player={player} />
        </li>
      ))}
      <li className={styles.cardSlot}>
        <YourCard />
      </li>
    </ul>
  );
}

function NameLines({ name }: { name: string }) {
  return (
    <h3 className={styles.cardName}>
      {name.split(" ").map((part) => (
        <span key={part}>{part}</span>
      ))}
    </h3>
  );
}

function Figures({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <dl className={styles.cardRows}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="tabular">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SampleCard({ player }: { player: (typeof SAMPLE_PLAYERS)[number] }) {
  const [turned, setTurned] = useState(false);
  const { main, rows } = cardFigures(player);

  return (
    <div className={styles.cardLift}>
      <div className={styles.cardInner} data-turned={turned || undefined}>
        <div className={styles.cardFace}>
          <p className={styles.cardHead}>
            <span>{player.team}</span>
            <span className="tabular">{player.matches} matches</span>
          </p>
          <NameLines name={player.name} />
          <p className={styles.cardMain}>
            <strong className="tabular">{main.value}</strong> {main.label}
          </p>
          <Figures rows={rows} />
        </div>

        <div className={`${styles.cardFace} ${styles.cardBack}`}>
          <p className={styles.cardHead}>
            <span>{player.name}</span>
          </p>
          <h4 className={styles.cardBackTitle}>Last three matches</h4>
          <ol className={styles.cardRecent}>
            {player.recent.map((m) => (
              <li key={m.opponent}>
                <span>v {m.opponent}</span>
                <strong className="tabular">{m.line}</strong>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <button
        type="button"
        className={styles.cardTurn}
        data-turned={turned || undefined}
        aria-label={`${turned ? "Turn back" : "Turn over"} ${player.name}'s card`}
        onClick={() => setTurned((t) => !t)}
      >
        <span>{turned ? "Turn back" : "Turn over"}</span>
      </button>
    </div>
  );
}

/** Keeps a long name on one line of the card rather than scrolling out of sight. */
function nameScale(length: number): number {
  if (length > 18) return 0.5;
  if (length > 11) return 0.74;
  return 1;
}

/**
 * Starts empty. A name already on this device fills in with its real record, so
 * the card never tells someone with a season behind them that they have nothing.
 */
function YourCard() {
  const [name, setName] = useState("");
  const [careers, setCareers] = useState<Career[]>([]);

  useEffect(() => {
    setCareers(loadCareers());
  }, []);

  const career = useMemo(() => {
    const key = careerKey(name);
    return key ? careers.find((c) => c.key === key) : undefined;
  }, [careers, name]);
  const figures = career && cardFigures(career);

  return (
    <div className={styles.cardLift}>
      <div className={`${styles.cardFace} ${styles.cardYours}`}>
        <p className={styles.cardHead}>
          <span>Your team</span>
          <span className="tabular">
            {career ? `${career.matches} ${career.matches === 1 ? "match" : "matches"}` : "0 matches"}
          </span>
        </p>
        <label className={styles.cardNameField}>
          <span className="visually-hidden">Your name, for this card</span>
          <input
            className={styles.cardNameInput}
            style={{ fontSize: `max(16px, ${nameScale(name.length)}em)` }}
            type="text"
            name="card-name"
            placeholder="Your name"
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p className={styles.cardMain}>
          <strong className="tabular">{figures?.main.value ?? "0"}</strong> {figures?.main.label ?? "runs"}
        </p>
        <Figures rows={figures?.rows ?? BLANK_ROWS} />
        <p className={styles.cardNote} aria-live="polite">
          {career
            ? "Added up from the matches on this device."
            : "Empty for now. Score one match and it starts adding up."}
        </p>
        {career ? (
          <Link href={`/player/${encodeURIComponent(career.key)}`} className={styles.cardAction}>
            See the full record
          </Link>
        ) : (
          <Link href="/match/new" className={styles.cardAction}>
            Score a match
          </Link>
        )}
      </div>
    </div>
  );
}
