import type { OverRecord } from "@/lib/scoring/types";
import styles from "./scoring.module.css";
import { useT } from "@/lib/i18n/use-language";

const BALLS_SHOWN = 6;

/**
 * This over, as the scorebook grid — the same motif the landing page is built
 * from. Six cells fill left to right; wides and no-balls add a cell rather
 * than taking one, which is how a paper book handles them too.
 */
export function OverStrip({ over, justLanded }: { over: OverRecord | null; justLanded: boolean }) {
  const t = useT();
  const marks = over?.marks ?? [];
  const blanks = Math.max(0, BALLS_SHOWN - marks.filter((m) => m.legal).length);

  return (
    <div className={styles.over}>
      <span className={styles.overLabel}>
        {t("over")} {over?.number ?? 1}
      </span>
      <div className={styles.cells}>
        {marks.map((m, i) => {
          const last = i === marks.length - 1;
          const kind = m.wicket
            ? styles.cellWicket
            : !m.legal || m.notation.endsWith("b") || m.notation.endsWith("lb")
              ? styles.cellExtra
              : m.runs === 6
                ? styles.cellSix
                : m.runs >= 4
                  ? styles.cellBoundary
                  : "";
          return (
            <span
              key={i}
              className={`${styles.cell} ${kind} ${last && justLanded ? styles.cellNew : ""}`}
            >
              {m.notation}
            </span>
          );
        })}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`blank-${i}`} className={`${styles.cell} ${styles.cellEmpty}`} aria-hidden>
            ·
          </span>
        ))}
      </div>
    </div>
  );
}
