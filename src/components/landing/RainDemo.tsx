"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { inningsResources, reviseTarget } from "@/lib/scoring/dls";
import styles from "./landing.module.css";

const SCORE = 168;
const FULL = 20;
const LEAST = 5;

/**
 * Drag the overs down and watch the target move, on the same table the scorer
 * uses. The harder it rains the fewer overs are left, so the rain on the page is
 * the slider's value made visible, and it only runs while the section is on screen.
 */
export function RainDemo() {
  const [overs, setOvers] = useState(10);
  const box = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const target = reviseTarget(SCORE, inningsResources(FULL, []), inningsResources(overs, []));
  // What simply scaling by overs would ask for, to show what DLS changes.
  const plain = Math.floor((SCORE * overs) / FULL) + 1;
  const perOver = (target / overs).toFixed(1);
  const rain = (FULL - overs) / (FULL - LEAST);

  return (
    <section
      className={styles.rainSection}
      ref={box}
      aria-labelledby="rain-heading"
      data-on={inView || undefined}
    >
      <span className={styles.rainLayer} style={{ opacity: rain }} aria-hidden />
      <div className={styles.rainInner}>
        <div className={styles.rainCopy}>
          <h2 id="rain-heading" className={styles.sectionTitle}>Rain stops play. Crickit doesn&rsquo;t.</h2>
          <p className={styles.sectionLede}>
            Deccan Club are chasing {SCORE} when the clouds roll in. Pull the overs down and
            see the DLS target change, on the same table the app uses at the ground.
          </p>
          <label className={styles.rainControl}>
            <span className={styles.rainControlLabel}>
              Overs left to play: <strong className="tabular">{overs}</strong>
            </span>
            <input
              type="range"
              className={styles.rainRange}
              min={LEAST}
              max={FULL}
              step={1}
              value={overs}
              onChange={(e) => setOvers(Number(e.target.value))}
            />
          </label>
          <Link href="/match/new" className={styles.rainLink}>Score a match</Link>
        </div>

        <div className={styles.board} aria-live="polite">
          <span className={styles.boardLabel}>Deccan Club need</span>
          <strong className={`${styles.boardTarget} tabular`}>{target}</strong>
          <span className={`${styles.boardSub} tabular`}>
            from {overs} overs, {perOver} an over
          </span>
          <span className={`${styles.boardCompare} tabular`}>
            {overs === FULL
              ? "A full chase: one more than the score."
              : `Plain run rate would ask for ${plain}. DLS asks for ${target}, because they still have all ten wickets.`}
          </span>
        </div>
      </div>
    </section>
  );
}
