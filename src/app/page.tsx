import Link from "next/link";
import ScrollReveal from "@/components/reactbits/ScrollReveal";
import { Book } from "@/components/landing/Book";
import { CloseBall } from "@/components/landing/CloseBall";
import { Delivery } from "@/components/landing/Delivery";
import { Drum } from "@/components/landing/Drum";
import { Listen } from "@/components/landing/Listen";
import { PlayerCards } from "@/components/landing/PlayerCards";
import { RainDemo } from "@/components/landing/RainDemo";
import { RecentMatches } from "@/components/landing/RecentMatches";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { TryPanel } from "@/components/landing/TryPanel";
import styles from "@/components/landing/landing.module.css";
import { HEARD } from "@/lib/parse/real-output";

/**
 * The landing page. One object from start to finish: a ball is bowled at you,
 * its leather opens into the next section, and a scorebook turns its own pages.
 * Motion is GSAP ScrollTrigger on Lenis; the sticky layouts underneath are plain
 * CSS, so the page reads in order if none of that runs.
 */
export default function Home() {
  return (
    <>
      <SmoothScroll />
      <main>
        <Delivery />

        <section className={styles.statement}>
          <ScrollReveal
            containerClassName={styles.statementBox}
            textClassName={styles.statementText}
            baseOpacity={0.16}
            baseRotation={0}
            blurStrength={3}
          >
            A twenty-over match is 240 deliveries. Someone writes every one of them
            down, head bent, for three hours, while their friends play. Crickit takes
            the pen. You watch the cricket and say what you saw.
          </ScrollReveal>
          <span className={styles.seam} aria-hidden />
        </section>

        <Book />

        <div className={styles.fieldUltra}>
        <section className={styles.trySection} id="try" aria-labelledby="try-heading">
          <div className={styles.tryIntro}>
            <h2 id="try-heading" className={styles.sectionTitle}>Now you call one.</h2>
            <p className={styles.sectionLede}>
              Hold the button and say a ball in your language, or tap a phrase if
              you are somewhere quiet. Nothing to sign up for. Your voice goes to
              Gnani&rsquo;s speech API to be transcribed.
            </p>
          </div>
          <TryPanel />
        </section>
        </div>

        <div className={styles.fieldCream}>
        <section className={styles.section} aria-labelledby="listen-heading">
          <div className={styles.split}>
            <h2 id="listen-heading" className={styles.sectionTitle}>And it calls it back.</h2>
            <p className={styles.sectionLede}>
              Each ball can become a line of commentary, with the shout where a shout
              belongs. Press play: this is the real speech model, not a mock-up.
            </p>
          </div>
          <Listen />
        </section>
        </div>

        <Drum />

        <section className={styles.ledgerSection} aria-labelledby="heard-heading">
          <div className={styles.ledgerInner}>
            <div className={styles.split}>
              <h2 id="heard-heading" className={styles.sectionTitle}>Nobody speaks neatly at a ground.</h2>
              <p className={styles.sectionLede}>
                Lines the speech model returned in testing, and what went in the book.
                Each row is a test in the suite, so it fails loudly if it stops being true.
              </p>
            </div>
            <table className={styles.ledger}>
              <thead>
                <tr>
                  <th scope="col">Heard</th>
                  <th scope="col">In the book</th>
                  <th scope="col" className={styles.ledgerWhy}>Why it is hard</th>
                </tr>
              </thead>
              <tbody>
                {HEARD.map((h) => (
                  <tr key={h.said}>
                    <td className={styles.ledgerSaid}>{h.said}</td>
                    <th scope="row">{h.got}</th>
                    <td className={styles.ledgerWhy}>{h.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className={styles.fieldNight}>
        <section className={styles.section} aria-labelledby="measured-heading">
          <div className={styles.split}>
            <h2 id="measured-heading" className={styles.sectionTitle}>Then we added crowd noise.</h2>
            <div className={styles.prose}>
              <p>
                The same six deliveries, through a studio mic, an 8&nbsp;kHz phone line,
                and that phone line under crowd noise. With 5&nbsp;dB of signal over the
                crowd and the squad listed in both scripts, giving the model those names
                took player recognition from <strong>50% to 100%</strong>, and correctly
                read deliveries from <strong>83% to 100%</strong>.
              </p>
              <p>
                Squads listed in Latin script alone reached only 33% on the same audio,
                which is why every player can now carry a local spelling.
              </p>
              <p className={styles.proseNote}>
                A synthetic voice and synthetic noise, six deliveries each. Enough to
                choose a design, not a claim about your ground.
              </p>
            </div>
          </div>
        </section>

        </div>

        <RainDemo />

        <div className={styles.fieldPitch}>
        <section className={styles.section} aria-labelledby="cards-heading">
          <div className={styles.split}>
            <h2 id="cards-heading" className={styles.sectionTitle}>Every player gets a card.</h2>
            <p className={styles.sectionLede}>
              Runs, wickets and best scores add up from every match you score on this
              device. Turn a card over for the last three games, then put your own name
              on the blank one.
            </p>
          </div>
          <PlayerCards />
        </section>
        </div>

        <div className={styles.fieldUltra}>
        <RecentMatches />
        <section className={styles.close} aria-labelledby="close-heading">
          <h2 id="close-heading" className={styles.closeTitle}>Next Sunday, watch the whole match.</h2>
          <Link href="/match/new" className={styles.primary}>Start a match</Link>
          <CloseBall />
        </section>
        </div>
      </main>

      <div className={styles.fieldNight}>
      <footer className={styles.foot}>
        <nav className={styles.footLinks} aria-label="Footer">
          <Link href="/match/new">Start a match</Link>
          <Link href="/discover">Find matches</Link>
          <Link href="/tournaments/new">Create a tournament</Link>
          <Link href="/players">Players</Link>
          <a href="#try">Try it</a>
        </nav>

        <details className={styles.goodToKnow}>
          <summary>Good to know</summary>
          <dl>
            <div>
              <dt>Calling a ball</dt>
              <dd>You hold the button for each ball. Hands-free listening is not built yet.</dd>
            </div>
            <div>
              <dt>Rain targets</dt>
              <dd>
                They use the ICC&rsquo;s published Standard Edition table, its stated fallback.
                Internationals use licensed software, so numbers can differ. The table assumes
                eleven-a-side.
              </dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>
                The ten here are what the speech models offer. Assamese, Manipuri and other
                North-East languages are not among them yet.
              </dd>
            </div>
            <div>
              <dt>Your data</dt>
              <dd>
                Matches live in this browser, so clearing its data clears them. Each ball&rsquo;s
                audio and your squad names go to Gnani&rsquo;s speech API. Crickit does not store
                the audio. Calling a ball needs a connection; the keypad does not.
              </dd>
              <dd>
                A match goes online only if you choose to share it. Then its teams, ground,
                score and player names are public until you press Stop sharing. Tournaments
                are always public.
              </dd>
            </div>
          </dl>
        </details>

        <p>
          <strong>Crickit</strong> runs on Gnani&rsquo;s Prisma v3.0 speech recognition and
          Timbre v3.0 speech synthesis. Built for The Great Indian AI Internship Challenge.
        </p>
        <p className={styles.footThin}>Names, teams and figures on this page are made up.</p>
      </footer>
      </div>
    </>
  );
}
