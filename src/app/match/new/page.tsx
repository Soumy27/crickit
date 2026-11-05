"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import pub from "@/components/public/public.module.css";
import { newCode, saveMatch } from "@/lib/match/store";
import { LOCATE_MESSAGES, tournamentKey, useLocate } from "@/lib/public/client";
import type { Place } from "@/lib/public/geo";
import { LANGUAGES } from "@/lib/gnani/languages";
import type { MatchFormat } from "@/lib/scoring/match";
import type { Player } from "@/lib/scoring/types";
import styles from "./setup.module.css";
import type { StringKey } from "@/lib/i18n/strings";
import { useT } from "@/lib/i18n/use-language";

/**
 * One name per line. A second spelling after a slash is how a squad gets both
 * scripts — the experiment in scripts/keyterms-ab.ts found that a Latin-only
 * squad list matched only 17% of players even on clean audio, because Prisma
 * returns the Devanagari form about as often as not.
 */
function parseSquad(raw: string, prefix: string): Player[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [name, ...rest] = line.split("/").map((s) => s.trim());
      const aliases = rest.filter(Boolean);
      return { id: `${prefix}${i}`, name, ...(aliases.length ? { aliases } : {}) };
    });
}

export default function NewMatchPage() {
  const t = useT();
  const router = useRouter();
  const [battingTeam, setBattingTeam] = useState("");
  const [bowlingTeam, setBowlingTeam] = useState("");
  const [battingSquad, setBattingSquad] = useState("");
  const [bowlingSquad, setBowlingSquad] = useState("");
  const [venue, setVenue] = useState("");
  const [overs, setOvers] = useState("20");
  const [format, setFormat] = useState<MatchFormat>("limited");
  const [days, setDays] = useState("5");
  const [language, setLanguage] = useState("indic-auto");
  // A key, not text: the fixture check below runs on mount, before the language has settled.
  const [error, setError] = useState<StringKey | null>(null);
  const [listed, setListed] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [tournament, setTournament] = useState<{ code: string; key: string; name: string } | null>(null);
  const { locate, state: locating } = useLocate();
  const locateMessage = LOCATE_MESSAGES[locating];

  // A fixture opened from a tournament page arrives with its teams and overs set.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("t");
    if (!code) return;
    const key = tournamentKey(code);
    if (!key) {
      setError("noScorerLink");
      return;
    }
    setBattingTeam(params.get("a") ?? "");
    setBowlingTeam(params.get("b") ?? "");
    void fetch(`/api/tournaments/${code}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ name: string; overs: number }>) : null))
      .then((found) => {
        if (!found) return setError("tournamentLoadFailed");
        setOvers(String(found.overs));
        setTournament({ code, key, name: found.name });
      })
      .catch(() => setError("tournamentLoadFailed"));
  }, []);

  const isPublic = listed || tournament !== null;

  function start() {
    const batting = parseSquad(battingSquad, "b");
    const bowling = parseSquad(bowlingSquad, "o");

    if (!battingTeam.trim() || !bowlingTeam.trim()) {
      return setError("errTeams");
    }
    if (battingTeam.trim().toLowerCase() === bowlingTeam.trim().toLowerCase()) {
      return setError("errSameTeam");
    }
    // Both sides bat now, so both need a pair to open with.
    if (batting.length < 2 || bowling.length < 2) return setError("errSquads");

    const id = crypto.randomUUID();
    const maxOvers = format === "test" || overs.trim() === "" ? null : Number(overs);
    if (maxOvers !== null && (!Number.isInteger(maxOvers) || maxOvers < 1)) {
      return setError("errOvers");
    }

    saveMatch({
      id,
      code: newCode(),
      venue: venue.trim() || "Local ground",
      startedAt: new Date().toISOString(),
      language,
      rules: format === "test" ? { format, days: Number(days) } : { format },
      setup: {
        battingTeam: battingTeam.trim(),
        bowlingTeam: bowlingTeam.trim(),
        batting,
        bowling,
        strikerId: batting[0].id,
        nonStrikerId: batting[1].id,
        bowlerId: bowling[0].id,
        maxOvers,
      },
      events: [],
      ...(isPublic
        ? {
            listing: {
              wanted: true,
              ...place,
              ...(tournament ? { tournament: { code: tournament.code, key: tournament.key } } : {}),
            },
          }
        : {}),
    });
    router.push(`/match/${id}`);
  }

  const [partOfBefore, partOfAfter] = t("partOfTournament").split("{name}");

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.back}>← Crickit</Link>
      <h1 className={styles.title}>{t("newMatch")}</h1>

      <fieldset className={styles.formats}>
        <legend className={styles.label}>{t("matchFormat")}</legend>
        {(["limited", "test"] as const).map((f) => (
          <label key={f} className={styles.format} data-on={format === f || undefined}>
            <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} />
            {f === "limited" ? t("limitedOvers") : t("testMatch")}
          </label>
        ))}
      </fieldset>

      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="batting">{t("battingFirst")}</label>
          <input id="batting" className={styles.input} value={battingTeam}
            onChange={(e) => setBattingTeam(e.target.value)} placeholder="Shivaji XI" />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="bowling">{t("bowlingFirst")}</label>
          <input id="bowling" className={styles.input} value={bowlingTeam}
            onChange={(e) => setBowlingTeam(e.target.value)} placeholder="Deccan Club" />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="bsquad">{t("battingSquad")}</label>
        <textarea id="bsquad" className={styles.area} value={battingSquad}
          onChange={(e) => setBattingSquad(e.target.value)}
          placeholder={"Rutvik / ऋत्विक\nOmkar / ओंकार\nPrathamesh / प्रथमेश"} />
        <p className={styles.help}>
          {t("squadHelp")} {t("squadSpelling")}
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="osquad">{t("bowlingSquad")}</label>
        <textarea id="osquad" className={styles.area} value={bowlingSquad}
          onChange={(e) => setBowlingSquad(e.target.value)}
          placeholder={"Dhananjay / धनंजय\nSarfaraz / सरफराज"} />
      </div>

      <div className={styles.pair}>
        {format === "limited" ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="overs">{t("overs")}</label>
            <input id="overs" className={styles.input} value={overs} inputMode="numeric"
              onChange={(e) => setOvers(e.target.value)} placeholder="20" />
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="days">{t("matchDays")}</label>
            <select id="days" className={styles.select} value={days}
              onChange={(e) => setDays(e.target.value)}>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="lang">{t("youWillCallIn")}</label>
          <select id="lang" className={styles.select} value={language}
            onChange={(e) => setLanguage(e.target.value)}>
            <option value="indic-auto">{t("whateverComesOut")}</option>
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="venue">{t("ground")}</label>
        <input id="venue" className={styles.input} value={venue}
          onChange={(e) => setVenue(e.target.value)} placeholder="Wagholi" />
      </div>

      {tournament ? (
        <p className={styles.help}>
          {partOfBefore}<strong>{tournament.name}</strong>{partOfAfter} {t("tournamentMatchesPublic")}
        </p>
      ) : (
        <fieldset className={styles.formats}>
          <legend className={styles.label}>{t("whoCanSee")}</legend>
          {[false, true].map((value) => (
            <label key={String(value)} className={styles.format} data-on={listed === value || undefined}>
              <input type="radio" name="listing" checked={listed === value} onChange={() => setListed(value)} />
              {t(value ? "anyone" : "onlyThisPhone")}
            </label>
          ))}
        </fieldset>
      )}

      {isPublic && (
        <div className={styles.field}>
          {!tournament && (
            <p className={styles.help}>
              {t("sharePrivacyWarning")} {t("stopAnyTime")}
            </p>
          )}
          <div className={pub.placeRow}>
            <button
              type="button"
              className={pub.quiet}
              disabled={locating === "locating"}
              onClick={async () => setPlace(await locate())}
            >
              {t(place ? "groundAdded" : "atTheGround")}
            </button>
            {place && (
              <button type="button" className={pub.quiet} onClick={() => setPlace(null)}>{t("remove")}</button>
            )}
          </div>
          <p className={styles.help}>
            {t(locateMessage ?? "savedNearMatch")}
          </p>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{t(error)}</p>}

      <button type="button" className={styles.submit} onClick={start}>
        {t("startScoring")}
      </button>
    </main>
  );
}
