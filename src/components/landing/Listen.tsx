"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";

/**
 * The commentary, out loud.
 *
 * Real Timbre v3.0 output, rendered once by scripts/make-samples.ts rather than
 * synthesised per visit: the line never changes, and a rate-limited first click
 * would be a poor trade for realism.
 */
const CLIPS = [
  { id: "six-hi", language: "Hindi", lang: "hi", line: "छक्का! रुत्विक ने गेंद मैदान के बाहर भेज दी। क्या शॉट था।" },
  { id: "four-mr", language: "Marathi", lang: "mr", line: "चौकार! ओंकारचा सुंदर फटका. चेंडू सीमारेषेपार." },
  { id: "wicket-en", language: "English", lang: "en", line: "Bowled him! Kaustubh walks back, and that is the breakthrough." },
];

export function Listen() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  function toggle(id: string) {
    // One at a time: three commentators over each other is a bug, not a demo.
    audio.current?.pause();
    setFailed(null);
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const el = new Audio(`/samples/${id}.mp3`);
    const fail = () => {
      setPlaying(null);
      setFailed(id);
    };
    el.onended = () => setPlaying(null);
    el.onerror = fail;
    audio.current = el;
    setPlaying(id);
    void el.play().catch(fail);
  }

  return (
    <ul className={styles.clips}>
      {CLIPS.map((c) => {
        const on = playing === c.id;
        return (
          <li key={c.id} className={styles.clip}>
            <button
              type="button"
              className={styles.clipPlay}
              data-on={on || undefined}
              onClick={() => toggle(c.id)}
              aria-label={`${on ? "Stop" : "Play"} the ${c.language} commentary`}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden fill="currentColor">
                {on ? <rect x="3" y="3" width="10" height="10" rx="1" /> : <path d="M4 2.5v11l9-5.5z" />}
              </svg>
            </button>
            <div>
              <p className={styles.clipLine} lang={c.lang}>{c.line}</p>
              <p className={styles.clipMeta}>
                {failed === c.id ? "That clip would not play. Try again." : c.language}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
