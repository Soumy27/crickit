"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import form from "@/app/match/new/setup.module.css";
import styles from "@/components/public/public.module.css";
import { useT } from "@/lib/i18n/use-language";
import { LOCATE_MESSAGES, rememberTournamentKey, useLocate } from "@/lib/public/client";
import type { Place } from "@/lib/public/geo";

export default function NewTournamentPage() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [overs, setOvers] = useState("10");
  const [startsOn, setStartsOn] = useState("");
  const [teams, setTeams] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { locate, state } = useLocate();
  const locateMessage = LOCATE_MESSAGES[state];

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          city,
          overs: Number(overs),
          startsOn,
          teams: teams.split("\n"),
          ...place,
        }),
      });
      const body = (await res.json()) as { code?: string; key?: string; error?: string };
      if (!res.ok || !body.code || !body.key) throw new Error(body.error ?? t("createFailed"));
      rememberTournamentKey(body.code, body.key);
      router.push(`/t/${body.code}`);
    } catch (err) {
      const offline = err instanceof TypeError;
      setError(offline ? t("createOffline") : (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className={form.page}>
      <Link href="/discover" className={form.back}>← {t("findMatches")}</Link>
      <h1 className={form.title}>{t("newTournament")}</h1>
      <p className={form.help}>{t("tournamentPublic")}</p>

      <div className={form.field}>
        <label className={form.label} htmlFor="t-name">{t("tournamentName")}</label>
        <input id="t-name" className={form.input} value={name} maxLength={80}
          onChange={(e) => setName(e.target.value)} placeholder="Wagholi Premier League" />
      </div>

      <div className={form.pair}>
        <div className={form.field}>
          <label className={form.label} htmlFor="t-city">{t("townOrCity")}</label>
          <input id="t-city" className={form.input} value={city} maxLength={60}
            onChange={(e) => setCity(e.target.value)} placeholder="Pune" />
        </div>
        <div className={form.field}>
          <label className={form.label} htmlFor="t-overs">{t("oversASide")}</label>
          <input id="t-overs" className={form.input} value={overs} inputMode="numeric"
            onChange={(e) => setOvers(e.target.value)} />
        </div>
      </div>

      <div className={form.field}>
        <label className={form.label} htmlFor="t-date">{t("firstMatchOptional")}</label>
        <input id="t-date" className={form.input} type="date" value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)} />
      </div>

      <div className={form.field}>
        <label className={form.label} htmlFor="t-teams">{t("teams")}</label>
        <textarea id="t-teams" className={form.area} value={teams}
          onChange={(e) => setTeams(e.target.value)}
          placeholder={"Shivaji XI\nDeccan Club\nKalyan Colts\nMill Road CC"} />
        <p className={form.help}>{t("teamsHelp")}</p>
      </div>

      <div className={form.field}>
        <span className={form.label}>{t("showNearby")}</span>
        <div className={styles.placeRow}>
          <button
            type="button"
            className={styles.quiet}
            disabled={state === "locating"}
            onClick={async () => setPlace(await locate())}
          >
            {t(place ? "groundAdded" : "atTheGround")}
          </button>
          {place && (
            <button type="button" className={styles.quiet} onClick={() => setPlace(null)}>{t("remove")}</button>
          )}
        </div>
        <p className={form.help}>
          {t(locateMessage ?? "savedNearTournament")}
        </p>
      </div>

      {error && <p className={form.error} role="alert">{error}</p>}

      <button type="button" className={form.submit} onClick={create} disabled={busy}>
        {t(busy ? "creating" : "createTournament")}
      </button>
    </main>
  );
}
