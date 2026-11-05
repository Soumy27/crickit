"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { TryIt } from "./TryIt";
import styles from "./landing.module.css";

gsap.registerPlugin(useGSAP);

/**
 * The demo, on a page that leans toward the pointer and flattens under it:
 * what sits on the surface is a mic button, and aiming at a moving target is
 * not charming. Mouse only, since a finger has no "toward".
 */
export function TryPanel() {
  const stage = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () => {
        const el = sheet.current;
        if (!el) return;
        const rx = gsap.quickTo(el, "rotationX", { duration: 0.7, ease: "power3.out" });
        const ry = gsap.quickTo(el, "rotationY", { duration: 0.7, ease: "power3.out" });

        const move = (e: PointerEvent) => {
          const box = el.getBoundingClientRect();
          const inside =
            e.clientX >= box.left && e.clientX <= box.right &&
            e.clientY >= box.top && e.clientY <= box.bottom;
          if (inside) {
            rx(0);
            ry(0);
            return;
          }
          const dx = (e.clientX - (box.left + box.width / 2)) / window.innerWidth;
          const dy = (e.clientY - (box.top + box.height / 2)) / window.innerHeight;
          ry(gsap.utils.clamp(-7, 7, dx * 16));
          rx(gsap.utils.clamp(-7, 7, -dy * 16));
        };
        window.addEventListener("pointermove", move, { passive: true });
        return () => window.removeEventListener("pointermove", move);
      });
      return () => mm.revert();
    },
    { scope: stage },
  );

  return (
    <div className={styles.tryStage} ref={stage}>
      <div className={styles.trySheet} ref={sheet}>
        <span className={styles.underSheet} aria-hidden />
        <span className={styles.underSheet} aria-hidden />
        <TryIt />
      </div>
    </div>
  );
}
