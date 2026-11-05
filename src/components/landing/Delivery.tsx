"use client";

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LanguageSwitch } from "@/components/language/LanguageSwitch";
import SplitText from "@/components/reactbits/SplitText";
import { useT } from "@/lib/i18n/use-language";
import { CricketBall, type BallHandle } from "./CricketBall";
import styles from "./landing.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * The page's one big moment: the ball is bowled at you.
 *
 * It starts small and far off, comes up the pitch as you scroll, and the
 * leather it arrives with opens into the red of the next section. The opening
 * is a clip-path on a plain red layer, not the ball itself, so the transition
 * holds on a device that never got WebGL.
 */
export function Delivery() {
  const t = useT();
  const scene = useRef<HTMLElement>(null);
  const ball = useRef<BallHandle>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          wide: "(min-width: 700px) and (prefers-reduced-motion: no-preference)",
          narrow: "(max-width: 699px) and (prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const wide = Boolean(context.conditions?.wide);
          const q = gsap.utils.selector(scene);
          const ballEl = q(`.${styles.deliveryBall}`)[0] as HTMLElement;
          const tilt = q(`.${styles.ballTilt}`)[0] as HTMLElement;
          const sun = q(`.${styles.sun}`)[0] as HTMLElement;
          const hint = q(`.${styles.spinHint}`);
          const dust = q(`.${styles.dust}`);

          // Scroll, idle and the visitor's own spin are separate so that none of
          // them overwrites the others on the next frame.
          const spin = { x: 0.35, y: 0.6, z: 0, idle: 0, dragX: 0, dragY: 0 };
          const paint = () =>
            ball.current?.spin(spin.x + spin.dragX, spin.y + spin.idle + spin.dragY, spin.z);

          const idle = gsap.to(spin, {
            idle: Math.PI * 2,
            duration: 18,
            repeat: -1,
            ease: "none",
            onUpdate: paint,
          });

          // It drops into the hand once, the first time the page is seen.
          gsap.fromTo(
            q(`.${styles.ballDrop}`),
            { y: "-85svh" },
            { y: 0, duration: 1.05, ease: "bounce.out", delay: 0.15, clearProps: "transform" },
          );

          // A stock delivery: down to a length, off the pitch, and up at you.
          const pitch = wide ? { x: "9vw", y: "23svh", scale: 0.6 } : { x: "12vw", y: "30svh", scale: 0.5 };

          const flight = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: scene.current,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.6,
              invalidateOnRefresh: true,
              onToggle: (self) => {
                if (self.isActive) idle.play();
                else if (self.progress === 1) idle.pause();
              },
            },
          });

          flight
            .to(hint, { autoAlpha: 0, duration: 0.05 }, 0)
            .to(q(`.${styles.deliveryCopy}`), { y: "-8svh", autoAlpha: 0, duration: 0.3, ease: "power1.in" }, 0.02)
            .to(sun, { scale: 0.7, autoAlpha: 0, duration: 0.3, ease: "power1.in" }, 0)
            .to(ballEl, { ...pitch, duration: 0.26, ease: "power2.in" }, 0)
            .fromTo(
              q(`.${styles.pitchShadow}`),
              { autoAlpha: 0, scale: 0.4 },
              { autoAlpha: 1, scale: 1, duration: 0.26, ease: "power2.in" },
              0,
            )
            // It kicks at the moment of pitching, and the seam wobbles from there.
            .to(q(`.${styles.pitchShadow}`), { autoAlpha: 0, scale: 1.5, duration: 0.14, ease: "power1.out" }, 0.26)
            .fromTo(
              dust,
              { autoAlpha: 0.9, scale: 0.3, x: 0, y: 0 },
              {
                autoAlpha: 0,
                scale: 1,
                x: (i: number) => (i - (dust.length - 1) / 2) * (wide ? 74 : 42),
                y: (i: number) => -(wide ? 40 : 24) - (i % 2) * (wide ? 46 : 28),
                duration: 0.16,
                ease: "power2.out",
              },
              0.25,
            )
            .to(ballEl, { x: 0, y: 0, scale: 1.5, duration: 0.54, ease: "power2.in" }, 0.26)
            .to(spin, { x: "+=9", y: "+=4", duration: 0.7, onUpdate: paint }, 0)
            .to(spin, { z: 0.45, duration: 0.2, ease: "sine.inOut", yoyo: true, repeat: 3, onUpdate: paint }, 0.26)
            .fromTo(
              q(`.${styles.leather}`),
              { clipPath: "circle(0% at 50% 50%)" },
              { clipPath: "circle(120% at 50% 50%)", duration: 0.4, ease: "none" },
              0.45,
            )
            .to(ballEl, { autoAlpha: 0, duration: 0.1 }, 0.86);

          /* ---- Grab it and spin it. A flick keeps going, and slows down. ---- */
          let lastX = 0;
          let lastY = 0;
          let vx = 0;
          let vy = 0;
          let grabbing = false;
          let coast: gsap.core.Tween | undefined;

          const down = (e: PointerEvent) => {
            grabbing = true;
            lastX = e.clientX;
            lastY = e.clientY;
            vx = 0;
            vy = 0;
            coast?.kill();
            idle.pause();
            gsap.to(hint, { autoAlpha: 0, duration: 0.2 });
            try {
              ballEl.setPointerCapture(e.pointerId);
            } catch {
              // Without capture a drag off the ball simply ends the spin.
            }
          };
          const move = (e: PointerEvent) => {
            if (!grabbing) return;
            vx = (e.clientX - lastX) * 0.012;
            vy = (e.clientY - lastY) * 0.012;
            spin.dragY += vx;
            spin.dragX += vy;
            lastX = e.clientX;
            lastY = e.clientY;
            paint();
          };
          const up = () => {
            if (!grabbing) return;
            grabbing = false;
            coast = gsap.to(spin, {
              dragY: spin.dragY + vx * 18,
              dragX: spin.dragX + vy * 18,
              duration: 1.5,
              ease: "power3.out",
              onUpdate: paint,
              onComplete: () => void idle.play(),
            });
          };
          ballEl.addEventListener("pointerdown", down);
          ballEl.addEventListener("pointermove", move);
          ballEl.addEventListener("pointerup", up);
          ballEl.addEventListener("pointercancel", up);

          /* ---- Mouse only: the ball and its sun drift apart, for depth. ---- */
          let removeParallax: (() => void) | undefined;
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            const tx = gsap.quickTo(tilt, "x", { duration: 0.9, ease: "power3.out" });
            const ty = gsap.quickTo(tilt, "y", { duration: 0.9, ease: "power3.out" });
            const sx = gsap.quickTo(sun, "x", { duration: 1.2, ease: "power3.out" });
            const sy = gsap.quickTo(sun, "y", { duration: 1.2, ease: "power3.out" });
            const drift = (e: PointerEvent) => {
              const dx = e.clientX / window.innerWidth - 0.5;
              const dy = e.clientY / window.innerHeight - 0.5;
              tx(dx * 44);
              ty(dy * 44);
              sx(dx * -18);
              sy(dy * -18);
            };
            window.addEventListener("pointermove", drift, { passive: true });
            removeParallax = () => window.removeEventListener("pointermove", drift);
          }

          return () => {
            removeParallax?.();
            coast?.kill();
            ballEl.removeEventListener("pointerdown", down);
            ballEl.removeEventListener("pointermove", move);
            ballEl.removeEventListener("pointerup", up);
            ballEl.removeEventListener("pointercancel", up);
          };
        },
      );
      return () => mm.revert();
    },
    { scope: scene },
  );

  return (
    <section className={styles.delivery} ref={scene}>
      <div className={styles.deliverySticky}>
        <header className={styles.bar}>
          <span className={styles.wordmark}>Crickit</span>
          <nav className={styles.barNav} aria-label="Main">
            <LanguageSwitch />
            <Link href="/discover">{t("findMatches")}</Link>
            <Link href="/players">{t("players")}</Link>
          </nav>
        </header>

        <span className={styles.sun} aria-hidden>
          <span className={styles.spinHint}>Drag to spin</span>
        </span>

        <span className={styles.pitchShadow} aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={styles.dust} />)}
        </span>

        <div className={styles.deliveryBall}>
          <div className={styles.ballTilt}>
            <div className={styles.ballDrop}>
              <CricketBall ref={ball} />
            </div>
          </div>
        </div>

        <div className={styles.deliveryCopy}>
          <SplitText
            tag="h1"
            text="You call the match. We keep the book."
            className={styles.heroTitle}
            splitType="words"
            delay={55}
            duration={0.9}
            textAlign="left"
            trigger="load"
          />
          <p className={styles.heroLede}>
            Say what just happened, in any of ten languages, mixed however you
            actually speak. Crickit writes the scorecard, calls the commentary
            out loud, and keeps a record for every player.
          </p>
          <div className={styles.heroActions}>
            <Link href="/match/new" className={styles.primary}>
              {t("startMatch")}
            </Link>
            <a href="#try" className={styles.secondary}>Try it first</a>
          </div>
          <p className={styles.heroNote}>Limited overs with DLS rain rules, or a four-innings Test. No account, and your matches stay on this device unless you share them.</p>
        </div>

        <div className={styles.leather} aria-hidden />
      </div>
    </section>
  );
}
