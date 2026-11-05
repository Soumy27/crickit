"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/use-language";
import { LANGUAGE_ENGLISH, LANGUAGE_NATIVE, type UiLanguage } from "@/lib/i18n/strings";
import styles from "./picker.module.css";

const ORDER: UiLanguage[] = [
  "hi-IN", "mr-IN", "ta-IN", "te-IN", "kn-IN",
  "ml-IN", "bn-IN", "gu-IN", "pa-IN", "en-IN",
];

/**
 * The first thing anyone sees: ten scripts, pick one.
 *
 * It renders only after mount. On the server nothing has been chosen yet, so
 * server-rendering it would flash the picker at every returning scorer for
 * the length of one hydration.
 *
 * There is no dismiss button and Escape is not a trap door to nowhere — it
 * picks English, which is also one of the ten tiles. A required choice with
 * no default is a wall; a required choice with a visible default is a form.
 */
export function LanguagePicker() {
  const { chosen, set } = useLanguage();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Someone opening a score from WhatsApp came to see the score, not to set up an app.
  const publicPage = /^\/(m|t|discover)(\/|$)/.test(pathname);
  const open = mounted && !chosen && !publicPage;

  useEffect(() => {
    if (!open) return;
    heading.current?.focus();

    // The page behind must not scroll under the sheet, and tab must not
    // wander off into a form the scorer cannot see.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        set("en-IN");
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>("button");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, set]);

  if (!open) return null;

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="pick-heading">
      <div className={styles.panel} ref={panel}>
        <div className={styles.head}>
          <p className={styles.mark}>Crickit</p>
          <h1 className={styles.title} id="pick-heading" tabIndex={-1} ref={heading}>
            Choose your language
          </h1>
          <p className={styles.note}>
            This sets the app. Call the cricket in whichever language you like —
            it listens for all ten.
          </p>
        </div>

        <ul className={styles.grid}>
          {ORDER.map((code, i) => (
            <li
              key={code}
              className={styles.cell}
              // Short enough to read as one cascade, not as a queue.
              style={{ "--i": i } as React.CSSProperties}
            >
              <button
                type="button"
                className={styles.tile}
                onClick={() => set(code)}
                lang={code}
              >
                <span className={styles.native}>{LANGUAGE_NATIVE[code]}</span>
                <span className={styles.english}>{LANGUAGE_ENGLISH[code]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
