"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/use-language";
import styles from "@/components/stats/stats.module.css";

/**
 * Shown if a match screen ever throws. The ball log is saved before each render,
 * so nothing has been lost, and that is the first thing a scorer needs to know.
 */
export default function MatchError({ reset }: { reset: () => void }) {
  const t = useT();
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("crashTitle")}</h1>
      <p className={styles.subtitle}>{t("crashBody")}</p>
      <button type="button" className={styles.back} onClick={reset}>{t("retry")}</button>
      <Link href="/" className={styles.back}>← Crickit</Link>
    </main>
  );
}
