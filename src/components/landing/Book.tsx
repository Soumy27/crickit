"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BATTING, CAREER, LAST_BALLS, TEAM, TOTAL } from "./sample-match";
import styles from "./landing.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const CAPTIONS = [
  ["You say it.", "Eight balls, called out loud in Hindi. The said words stay beside each one, so a mistake can be checked and undone."],
  ["It becomes the card.", "Nobody typed a number. The card is worked out from those balls, down to the strike rates."],
  ["It outlives the match.", "Every player keeps a record, added up from every match on this device."],
] as const;

const strike = (runs: number, balls: number) => ((runs / balls) * 100).toFixed(1);

/**
 * A scorebook with real thickness that opens and turns its own pages.
 *
 * Each leaf hinges on its left edge and is rotated directly: no custom property
 * on the book, because that would restyle every row on every frame. Turned
 * leaves step forward in z so they land on top of the pile, as paper does.
 */
export function Book() {
  const scene = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          wide: "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
          narrow: "(max-width: 899px) and (prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const wide = Boolean(context.conditions?.wide);
          const q = gsap.utils.selector(scene);
          // Stacked back to front in the DOM, so the top leaf comes last.
          const [second, first, cover] = q(`.${styles.turning}`);
          const [shade2, shade1, shade0] = q(`.${styles.shade}`);
          const captions = q(`.${styles.caption}`);
          const rows = q(`.${styles.ruled} li`);
          const body = q(`.${styles.bookBody}`);

          gsap.set(cover, { z: 3 });
          gsap.set(first, { z: 2 });
          gsap.set(second, { z: 1 });
          gsap.set(captions, { autoAlpha: 0 });
          gsap.set(rows, { autoAlpha: 0, x: -10 });
          if (wide) gsap.set(body, { xPercent: -50, rotationY: -14, rotationX: 7 });
          else gsap.set(body, { rotationX: 5 });

          const turn = (leaf: HTMLElement, shade: HTMLElement, at: number, z: number) =>
            timeline
              .to(leaf, { rotationY: -179, z, duration: 0.14, ease: "power1.inOut" }, at)
              .fromTo(shade, { opacity: 0 }, { opacity: 0.55, duration: 0.07, ease: "none" }, at)
              .to(shade, { opacity: 0, duration: 0.07, ease: "none" }, at + 0.07);

          const timeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: scene.current,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.6,
            },
          });

          timeline.to(body, { xPercent: 0, rotationY: 0, rotationX: 0, duration: 0.12, ease: "power1.inOut" }, 0);
          turn(cover, shade0, 0, 11);
          timeline
            .to(captions[0], { autoAlpha: 1, duration: 0.04 }, 0.1)
            .to(rows, { autoAlpha: 1, x: 0, duration: 0.03, stagger: 0.024 }, 0.14);
          turn(first, shade1, 0.4, 12);
          timeline.to(captions[0], { autoAlpha: 0, duration: 0.03 }, 0.42).to(captions[1], { autoAlpha: 1, duration: 0.04 }, 0.5);
          turn(second, shade2, 0.66, 13);
          timeline
            .to(captions[1], { autoAlpha: 0, duration: 0.03 }, 0.68)
            .to(captions[2], { autoAlpha: 1, duration: 0.04 }, 0.76)
            .to({}, { duration: 0.14 }, 0.86);
        },
      );
      return () => mm.revert();
    },
    { scope: scene },
  );

  return (
    <section className={styles.bookScene} ref={scene} aria-labelledby="book-heading">
      <h2 id="book-heading" className="visually-hidden">How a match gets written down</h2>
      <div className={styles.bookSticky}>
        <div className={styles.bookStage}>
          <div className={styles.bookBody}>
            <div className={styles.pageBase}>
              <CareerPage />
            </div>

            <div className={styles.turning}>
              <div className={styles.front}><CardPage /><span className={styles.shade} /></div>
              <div className={styles.back} aria-hidden />
            </div>

            <div className={styles.turning}>
              <div className={styles.front}><LivePage /><span className={styles.shade} /></div>
              <div className={styles.back} aria-hidden />
            </div>

            <div className={styles.turning}>
              <div className={`${styles.front} ${styles.cover}`}>
                <span className={styles.coverStitch} aria-hidden />
                <span className={styles.coverTitle}>Crickit</span>
                <span className={styles.coverSub}>Scorebook</span>
                <span className={styles.shade} />
              </div>
              <div className={styles.back} aria-hidden />
            </div>
          </div>

          <ol className={styles.captions}>
            {CAPTIONS.map(([title, body]) => (
              <li key={title} className={styles.caption}>
                <h3 className={styles.captionTitle}>{title}</h3>
                <p className={styles.captionBody}>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function PageHead({ left, right }: { left: string; right: string }) {
  return (
    <div className={styles.paperHead}>
      <span>{left}</span>
      <strong className="tabular">{right}</strong>
    </div>
  );
}

function LivePage() {
  return (
    <div className={styles.paper}>
      <PageHead left={TEAM} right={`${TOTAL.runs}/${TOTAL.wickets}`} />
      <ul className={styles.ruled}>
        {LAST_BALLS.map((b, i) => (
          <li key={i}>
            <span className={`${styles.ruledOver} tabular`}>{b.over}</span>
            <span className={styles.ruledWho}>{b.who}</span>
            <span className={styles.ruledSaid} lang="hi">{b.said}</span>
            <span className={`${styles.ruledMark} ${b.mark === "4" || b.mark === "6" ? styles.ruledBig : ""}`}>
              {b.mark}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.paperFoot}>{TOTAL.overs} overs</p>
    </div>
  );
}

function CardPage() {
  return (
    <div className={styles.paper}>
      <PageHead left="Batting" right={`${TOTAL.runs}/${TOTAL.wickets}`} />
      <table className={styles.card}>
        <thead>
          <tr>
            <th scope="col">Batter</th>
            <th scope="col">R</th>
            <th scope="col">B</th>
            <th scope="col">4s</th>
            <th scope="col">6s</th>
            <th scope="col">SR</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {BATTING.map((b) => (
            <tr key={b.name}>
              <th scope="row">{b.name}</th>
              <td>{b.runs}{b.notOut ? "*" : ""}</td>
              <td>{b.balls}</td>
              <td>{b.fours}</td>
              <td>{b.sixes}</td>
              <td>{strike(b.runs, b.balls)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.paperFoot}>
        Extras {TOTAL.extras} · {TOTAL.overs} overs
      </p>
    </div>
  );
}

function CareerPage() {
  return (
    <div className={styles.paper}>
      <PageHead left={CAREER.name} right={`${CAREER.matches} matches`} />
      <dl className={styles.career}>
        {CAREER.figures.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className="tabular">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
