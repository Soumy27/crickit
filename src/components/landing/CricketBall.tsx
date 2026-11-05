"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { BallScene } from "./ball-scene";
import styles from "./landing.module.css";

export interface BallHandle {
  spin: (x: number, y: number, z?: number) => void;
}

/** A browser that keeps losing the context is out of memory: stop asking. */
const MAX_REBUILDS = 3;

/**
 * A ball that is a ball from the first paint, and stays one.
 *
 * A CSS drawing sits underneath and the WebGL ball fades in over it once three.js
 * has arrived. Where WebGL is missing the drawing simply stays. If the graphics
 * context dies later, as it can when a phone reclaims memory or a page comes back
 * from the background, the scene is thrown away and rebuilt on a fresh canvas,
 * with the drawing covering the gap.
 */
export const CricketBall = forwardRef<BallHandle, { className?: string }>(
  function CricketBall({ className }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const scene = useRef<BallScene | null>(null);
    const last = useRef<[number, number, number]>([0.35, 0.6, 0]);
    const [ready, setReady] = useState(false);

    useImperativeHandle(ref, () => ({
      spin(x, y, z = 0) {
        last.current = [x, y, z];
        scene.current?.spin(x, y, z);
      },
    }));

    useEffect(() => {
      const el = host.current;
      if (!el) return;
      let gone = false;
      let rebuilds = 0;
      let observer: ResizeObserver | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const teardown = () => {
        observer?.disconnect();
        observer = undefined;
        scene.current?.dispose();
        scene.current = null;
      };

      const rebuild = () => {
        if (gone) return;
        teardown();
        setReady(false);
        if (rebuilds >= MAX_REBUILDS) return;
        rebuilds += 1;
        timer = setTimeout(build, 300);
      };

      const build = () => {
        void import("./ball-scene")
          .then(({ createBall }) => createBall(el, rebuild))
          .then((made) => {
            if (gone) {
              made.dispose();
              return;
            }
            scene.current = made;
            made.spin(...last.current);
            observer = new ResizeObserver(() => made.resize());
            observer.observe(el);
            setReady(true);
          })
          .catch(() => {
            // No WebGL: the drawing underneath is the ball.
          });
      };

      // Coming back from the background or the back button can find the context
      // already dead, with no event having reached us.
      const recheck = () => {
        if (document.visibilityState === "visible" && scene.current?.lost()) rebuild();
      };
      document.addEventListener("visibilitychange", recheck);
      window.addEventListener("pageshow", recheck);

      build();

      return () => {
        gone = true;
        if (timer) clearTimeout(timer);
        document.removeEventListener("visibilitychange", recheck);
        window.removeEventListener("pageshow", recheck);
        teardown();
      };
    }, []);

    return (
      <div className={`${styles.ball} ${className ?? ""}`} aria-hidden>
        <span className={styles.ballDrawing} data-hidden={ready || undefined} />
        <div ref={host} className={styles.ballHost} data-ready={ready || undefined} />
      </div>
    );
  },
);
