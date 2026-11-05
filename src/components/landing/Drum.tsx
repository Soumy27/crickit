"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LANGUAGE_ENGLISH, LANGUAGE_NATIVE, type UiLanguage } from "@/lib/i18n/strings";
import styles from "./landing.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const ORDER: UiLanguage[] = [
  "hi-IN", "mr-IN", "ta-IN", "te-IN", "kn-IN",
  "ml-IN", "bn-IN", "gu-IN", "pa-IN", "en-IN",
];

/** Ten languages on a scoreboard drum, turned by the scroll. */
export function Drum() {
  const scene = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          `.${styles.drum}`,
          { rotationX: -6, rotationY: 18 },
          {
            rotationX: -6,
            // Stops with the tenth face square on, not back at the first.
            rotationY: -324 - 18,
            ease: "none",
            scrollTrigger: {
              trigger: scene.current,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.6,
            },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: scene },
  );

  return (
    <section className={styles.drumScene} ref={scene} aria-labelledby="langs-heading">
      <div className={styles.drumSticky}>
        <div className={styles.drumHead}>
          <h2 id="langs-heading" className={styles.sectionTitle}>
            Ten languages. Call it in yours.
          </h2>
          <p className={styles.sectionLede}>
            Set the app in one and shout in another. Language is detected on every
            ball, so switching mid-sentence is not switching a setting.
          </p>
        </div>
        <div className={styles.drumStage}>
          <ul className={styles.drum}>
            {ORDER.map((code, i) => (
              <li
                key={code}
                className={styles.face}
                style={{ transform: `rotateY(${i * 36}deg) translateZ(var(--radius))` }}
                lang={code}
              >
                <span className={styles.faceNative}>{LANGUAGE_NATIVE[code]}</span>
                {code !== "en-IN" && <span className={styles.faceEnglish}>{LANGUAGE_ENGLISH[code]}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
