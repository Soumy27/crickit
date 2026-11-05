"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CricketBall, type BallHandle } from "./CricketBall";
import styles from "./landing.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** The ball again at the end of the page, rolled over the rope by the scroll. */
export function CloseBall() {
  const box = useRef<HTMLDivElement>(null);
  const ball = useRef<BallHandle>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const spin = { y: 0 };
        gsap.fromTo(
          box.current,
          { x: "-55vw" },
          {
            x: 0,
            ease: "power2.out",
            scrollTrigger: {
              trigger: box.current,
              start: "top bottom",
              end: "bottom 70%",
              scrub: 0.6,
              onUpdate: (self) => {
                spin.y = self.progress * 9;
                ball.current?.spin(0.35, spin.y);
              },
            },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: box },
  );

  return (
    <div className={styles.closeBall} ref={box}>
      <span className={styles.closeShadow} aria-hidden />
      <CricketBall ref={ball} />
    </div>
  );
}
