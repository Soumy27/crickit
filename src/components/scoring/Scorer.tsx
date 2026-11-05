"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRecorder } from "@/lib/audio/use-recorder";
import { useMatch } from "@/lib/match/use-match";
import { bowlerLine, oversString, runRate } from "@/lib/scoring/engine";
import { buildMatch, chase, targetForOvers, teamTotals } from "@/lib/scoring/match";
import { describeResult, fill } from "@/lib/i18n/result";
import { generateCommentary } from "@/lib/commentary/generate";
import type { LanguageCode } from "@/lib/gnani/languages";
import { describeBall } from "@/lib/scoring/describe";
import type { BallEvent, DismissalKind, Player } from "@/lib/scoring/types";
import type { ParseOutcome } from "@/lib/parse/ball-parser";
import { CONFIRM_THRESHOLD } from "@/lib/parse/ball-parser";
import { useLanguage } from "@/lib/i18n/use-language";
import type { StringKey } from "@/lib/i18n/strings";
import { ShareBar } from "@/components/public/ShareBar";
import { MicButton } from "./MicButton";
import { OverStrip } from "./OverStrip";
import styles from "./scoring.module.css";

interface Chip {
  event: BallEvent;
  said: string;
  player?: Player;
  unsure: boolean;
}

const DISMISSALS: { kind: DismissalKind; label: StringKey }[] = [
  { kind: "bowled", label: "bowled" },
  { kind: "caught", label: "caught" },
  { kind: "lbw", label: "lbw" },
  { kind: "run_out", label: "runOut" },
  { kind: "stumped", label: "stumped" },
  { kind: "hit_wicket", label: "hitWicket" },
];

/** Manual entry. A scorer must never be stuck because the mic misheard. */
const PAD: { label: string; event: Omit<BallEvent, "type">; tone?: string }[] = [
  { label: "·", event: { batRuns: 0, extraRuns: 0 } },
  { label: "1", event: { batRuns: 1, extraRuns: 0 } },
  { label: "2", event: { batRuns: 2, extraRuns: 0 } },
  { label: "3", event: { batRuns: 3, extraRuns: 0 } },
  { label: "4", event: { batRuns: 4, extraRuns: 0 }, tone: styles.keyFour },
  { label: "6", event: { batRuns: 6, extraRuns: 0 }, tone: styles.keySix },
  { label: "wd", event: { batRuns: 0, extra: "wide", extraRuns: 0 }, tone: styles.keyExtra },
  { label: "nb", event: { batRuns: 0, extra: "noball", extraRuns: 0 }, tone: styles.keyExtra },
];

export function Scorer({ matchId }: { matchId: string }) {
  const { match, state, game, loading, record, undo, lastBall, setListing } = useMatch(matchId);
  const recorder = useRecorder();
  const { t, language: uiLanguage } = useLanguage();
  const words = useMemo(
    () => ({
      four: t("four"), six: t("six"), dotBall: t("dotBall"), run: t("oneRun"), runs: t("runs"), wide: t("wide"),
      noBall: t("noBall"), bye: t("bye"), legBye: t("legBye"), out: t("out"),
      dismissals: {
        bowled: t("bowled"), caught: t("caught"), lbw: t("lbw"), run_out: t("runOut"),
        stumped: t("stumped"), hit_wicket: t("hitWicket"),
      },
    }),
    [t],
  );

  const [chip, setChip] = useState<Chip | null>(null);
  const [ask, setAsk] = useState<{ partial: BallEvent; said: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [justLanded, setJustLanded] = useState(false);
  const [feed, setFeed] = useState<{ id: number; text: string }[]>([]);
  const [speakOn, setSpeakOn] = useState(false);
  const [rainOvers, setRainOvers] = useState("");
  const [nextOvers, setNextOvers] = useState("");
  const [opening, setOpening] = useState<{ striker?: string; nonStriker?: string; followOn?: boolean }>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lineId = useRef(0);

  const squad = useMemo<Player[]>(
    () => (match ? [...match.setup.batting, ...match.setup.bowling] : []),
    [match],
  );

  /**
   * The last delivery stays on screen until the next one replaces it.
   *
   * It was on a five-second timer; testing killed that. A scorer is watching
   * the match, not the phone, and glances down between balls — a chip that
   * has already gone takes the undo with it, which defeats the point.
   */
  const showChip = useCallback((next: Chip) => {
    setChip(next);
    setJustLanded(true);
  }, []);

  useEffect(() => {
    if (!justLanded) return;
    const t = setTimeout(() => setJustLanded(false), 400);
    return () => clearTimeout(t);
  }, [justLanded]);

  /** Speak a line. Triggered by the same gesture that recorded the ball, so
   *  autoplay policies allow it; a blocked play is not worth surfacing. */
  const say = useCallback((text: string, language: string) => {
    void (async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language }),
        });
        if (!res.ok) return;
        const url = URL.createObjectURL(await res.blob());
        audioRef.current?.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
      } catch {
        // Commentary is a flourish; never let it interrupt scoring.
      }
    })();
  }, []);

  const commitBall = useCallback(
    (event: BallEvent, said: string, player?: Player, unsure = false) => {
      const current = match;
      // Runs go to whoever is on strike, so that is who the chip and the
      // commentary name, even if the scorer said someone else's name.
      const striker = state?.strikerId ? state.batters[state.strikerId] : undefined;
      const batterName = striker?.name ?? "";

      record(event);
      showChip({
        event,
        said,
        player: striker ? { id: striker.id, name: striker.name } : player,
        unsure,
      });
      setHint(null);

      if (!current) return;
      // Fold the log ourselves so commentary sees the state after the ball,
      // rather than waiting a render for it.
      let after;
      try {
        after = buildMatch(current.setup, current.rules, [...current.events, event]).current;
      } catch {
        return;
      }
      // Called in anything, commentated in the language the scorer reads.
      const language = (current.language === "indic-auto" ? uiLanguage : current.language) as LanguageCode;
      const line = generateCommentary({
        event,
        state: after,
        batterName,
        bowlerName: after.bowlerId ? after.bowlers[after.bowlerId]?.name : undefined,
        language,
      });
      lineId.current += 1;
      setFeed((f) => [{ id: lineId.current, text: line.plain }, ...f].slice(0, 6));
      if (speakOn) say(line.text, language);
    },
    [match, record, say, showChip, speakOn, state, uiLanguage],
  );

  const handleStop = useCallback(async () => {
    const { clip, reason } = await recorder.stop();
    if (!clip) {
      // "That press opened the mic" is not the same message as "you tapped
      // instead of holding", and a duplicate stop must say nothing at all.
      if (reason === "arming") setHint(t("micIsOn"));
      else if (reason === "too_short") setHint(t("holdWhileSpeaking"));
      else if (reason === "unreadable") setHint(t("unreadable"));
      return;
    }

    const form = new FormData();
    form.append("audio", clip.blob, clip.filename);
    form.append("language", match?.language ?? "indic-auto");
    form.append("players", JSON.stringify(squad));
    form.append("hint", uiLanguage);

    try {
      const res = await fetch("/api/stt", { method: "POST", body: form });
      const body = (await res.json()) as {
        transcript?: string;
        parse?: ParseOutcome;
        error?: string;
        retry?: boolean;
        limited?: boolean;
      };

      if (!res.ok) {
        // Over the voice limit, so "say it again" would only fail again: send them to the keypad.
        if (body.limited && body.error) setHint(body.error);
        else setHint(body.retry ? t("tooManyAtOnce") : t("didntCatch"));
        return;
      }

      const parse = body.parse;
      const said = body.transcript ?? "";

      if (!parse || parse.status === "unparsed") {
        setHint(said ? `“${said}” ${t("heardNoBall")}` : t("didntCatch"));
        return;
      }
      if (parse.status === "needs_detail") {
        setAsk({ partial: parse.partial, said });
        setHint(null);
        return;
      }
      commitBall(parse.event, said, parse.player, parse.confidence < CONFIRM_THRESHOLD);
    } catch {
      setHint(t("noConnection"));
    } finally {
      recorder.settle();
    }
  }, [commitBall, match?.language, recorder, squad, t, uiLanguage]);

  if (loading) {
    return <div className={styles.loading}>Loading the match…</div>;
  }
  if (!match || !state || !game) {
    return (
      <div className={styles.fail}>
        <h1>{t("notOnDevice")}</h1>
        <p>{t("storedInBrowser")}</p>
      </div>
    );
  }

  const striker = state.strikerId ? state.batters[state.strikerId] : null;
  const nonStriker = state.nonStrikerId ? state.batters[state.nonStrikerId] : null;
  const bowler = state.bowlerId ? state.bowlers[state.bowlerId] : null;
  const currentOver = state.overs[state.overs.length - 1] ?? null;
  const blocked = state.awaiting.length > 0 || game.phase !== "playing" || ask !== null;
  // The squads for this innings, which swap sides after every innings.
  const innings = game.innings[game.innings.length - 1].setup;
  const chasing = chase(state);
  const isTest = game.rules.format === "test";

  /** Test matches read the score against the other side's running total. */
  const lead = (() => {
    if (!isTest || game.innings.length < 2 || game.phase === "finished") return null;
    const totals = teamTotals(game);
    const mine = totals.get(state.battingTeam) ?? 0;
    const theirs = totals.get(state.bowlingTeam) ?? 0;
    if (mine === theirs) return t("scoresLevel");
    return fill(t("leadBy"), {
      team: mine > theirs ? state.battingTeam : state.bowlingTeam,
      runs: Math.abs(mine - theirs),
    });
  })();

  // The second innings may be shorter than the first, if rain took the time.
  const parsedNext = Number(nextOvers);
  const nextOversValid =
    game.rainRules && nextOvers.trim() !== "" && Number.isInteger(parsedNext) &&
    parsedNext >= 1 && parsedNext <= (match.setup.maxOvers ?? 0);
  const previewTarget = nextOversValid ? targetForOvers(match.setup, game, parsedNext) : null;

  const useFollowOn = opening.followOn === true;
  const upcoming = useFollowOn ? game.followOnNext : game.next;

  const startInnings = (bowlerId: string) => {
    if (!opening.striker || !opening.nonStriker) return;
    record({
      type: "start_innings",
      strikerId: opening.striker,
      nonStrikerId: opening.nonStriker,
      bowlerId,
      ...(useFollowOn ? { followOn: true } : {}),
      ...(nextOversValid ? { maxOvers: parsedNext } : {}),
    });
    setOpening({});
    setNextOvers("");
    setChip(null);
    setFeed([]);
    setHint(null);
  };

  const applyRain = () => {
    const overs = Number(rainOvers);
    if (!Number.isInteger(overs) || overs * 6 < state.legalBalls || overs >= (state.maxOvers ?? 0)) {
      setHint(t("errOvers"));
      return;
    }
    const during = game.innings.length === 2;
    record({ type: "reduce_overs", maxOvers: overs });
    setRainOvers("");
    if (during) {
      const after = buildMatch(match.setup, match.rules, [...match.events, { type: "reduce_overs", maxOvers: overs }]);
      setHint(fill(t("revisedTarget"), { target: after.current.target ?? "" }));
    } else {
      setHint(null);
    }
  };

  const undoLast = () => {
    undo();
    setChip(null);
    setAsk(null);
    setOpening({});
    // The feed has to follow the log, or the screen contradicts itself: a line
    // about a ball that is no longer in the book.
    setFeed((f) => f.slice(1));
    setHint(t("takenBack"));
  };

  const waitingForBatter = state.awaiting.includes("new_batter");
  const waitingForBowler = state.awaiting.includes("new_bowler");

  return (
    <main className={styles.screen}>
      <header className={styles.scoreline}>
        <div className={styles.scoreTop}>
          <Link href="/" className={styles.mark}>Crickit</Link>
          <Link href={`/match/${matchId}/card`} className={styles.cardLink}>
            {t("fullScorecard")}
          </Link>
        </div>
        <div className={styles.scoreMain}>
          <div className={styles.scoreWho}>
            <span className={styles.teamName}>{state.battingTeam}</span>
            <h1 className={`${styles.total} tabular`} data-landed={justLanded || undefined}>
              {state.runs}
              <span className={styles.totalWickets}>/{state.wickets}</span>
            </h1>
          </div>
          <div className={`${styles.meta} tabular`}>
            <span>{t("innings")} {game.innings.length}</span>
            <strong>
              {oversString(state.legalBalls)}
              {state.maxOvers ? ` / ${state.maxOvers}` : ""} {t("overs")}
            </strong>
            <span>RR {runRate(state).toFixed(2)}</span>
            <span>{t("extras")} {state.extras.wides + state.extras.noballs + state.extras.byes + state.extras.legbyes}</span>
          </div>
        </div>
        {chasing && game.phase === "playing" && (
          <p className={`${styles.chaseLine} tabular`} role="status">
            {t("target")} {state.target} ·{" "}
            {chasing.balls === null
              ? fill(t("needRuns"), { runs: chasing.runs })
              : fill(t("needRunsBalls"), { runs: chasing.runs, balls: chasing.balls })}
            {game.dls?.parNow != null && ` · ${fill(t("dlsPar"), { par: game.dls.parNow })}`}
          </p>
        )}
        {!chasing && lead && game.phase === "playing" && (
          <p className={`${styles.chaseLine} tabular`}>{lead}</p>
        )}
      </header>

      <ShareBar match={match} setListing={setListing} />

      <OverStrip over={currentOver} justLanded={justLanded} />

      <section className={styles.crease}>
        {/* The screen's question: did that ball go in right? */}
        {chip && (
          <div className={styles.chip} role="status" aria-live="polite">
            <div className={styles.chipHead}>
              <span className={`${styles.chipVerdict} ${chip.unsure ? styles.chipUnsure : ""}`}>
                {describeBall(chip.event, chip.player?.name, words)}
              </span>
              <button
                type="button"
                className={styles.undo}
                onClick={undoLast}
              >
                {t("undo")}
              </button>
            </div>
            {chip.said && <span className={styles.chipSaid}>“{chip.said}”</span>}
            {chip.unsure && <span className={styles.chipSaid}>{t("notSure")}</span>}
          </div>
        )}

        {ask && (
          <div className={styles.ask}>
            <span className={styles.askTitle}>{t("howWasHeOut")}</span>
            {ask.said && <span className={styles.chipSaid}>“{ask.said}”</span>}
            <div className={styles.options}>
              {DISMISSALS.map((d) => (
                <button
                  key={d.kind}
                  type="button"
                  className={styles.option}
                  onClick={() => {
                    commitBall(
                      { ...ask.partial, wicket: { kind: d.kind, who: "striker" } },
                      ask.said,
                    );
                    setAsk(null);
                  }}
                >
                  {t(d.label)}
                </button>
              ))}
              <button type="button" className={styles.option} onClick={() => setAsk(null)}>
                {t("notOut")}
              </button>
            </div>
          </div>
        )}

        {waitingForBatter && (
          <div className={styles.ask}>
            <span className={styles.askTitle}>{t("whoIsIn")}</span>
            <div className={styles.options}>
              {innings.batting
                .filter(
                  (p) =>
                    !state.batters[p.id].out &&
                    p.id !== state.strikerId &&
                    p.id !== state.nonStrikerId,
                )
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.option}
                    onClick={() => record({ type: "new_batter", playerId: p.id })}
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        {waitingForBowler && !waitingForBatter && (
          <div className={styles.ask}>
            <span className={styles.askTitle}>{t("whoIsBowling")}</span>
            <div className={styles.options}>
              {innings.bowling.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.option}
                  onClick={() => record({ type: "new_bowler", playerId: p.id })}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {game.phase === "finished" && game.result && (
          <div className={styles.result} role="status">
            <span className={styles.resultLine}>{describeResult(game.result, t)}</span>
            <ol className={`${styles.inningsList} tabular`}>
              {game.innings.map((i) => (
                <li key={i.number}>
                  <span>{i.state.battingTeam}{i.followOn ? ` (${t("followOnLabel")})` : ""}</span>
                  <strong>{i.state.runs}/{i.state.wickets}{i.state.declared ? "d" : ""}</strong>
                </li>
              ))}
            </ol>
            <div className={styles.options}>
              <Link href={`/match/${matchId}/card`} className={`${styles.option} ${styles.optionPrimary}`}>
                {t("fullScorecard")}
              </Link>
              <Link href="/match/new" className={styles.option}>{t("newMatch")}</Link>
              <button type="button" className={styles.option} onClick={undoLast}>{t("undoLast")}</button>
            </div>
          </div>
        )}

        {game.phase === "between" && (
          <div className={styles.ask}>
            <p className={`${styles.chipSaid} tabular`}>
              {t("inningsComplete")} · {state.battingTeam} {state.runs}/{state.wickets}
              {state.declared ? "d" : ""} · {oversString(state.legalBalls)} {t("overs")}
            </p>

            {game.followOnAvailable && opening.followOn === undefined ? (
              <>
                <span className={styles.askTitle}>
                  {fill(t("followOnTitle"), {
                    team: state.bowlingTeam,
                    runs: (teamTotals(game).get(state.bowlingTeam) ?? 0) - state.runs,
                  })}
                </span>
                <div className={styles.options}>
                  <button type="button" className={`${styles.option} ${styles.optionPrimary}`}
                    onClick={() => setOpening({ followOn: true })}>
                    {fill(t("enforceFollowOn"), { team: state.battingTeam })}
                  </button>
                  <button type="button" className={styles.option}
                    onClick={() => setOpening({ followOn: false })}>
                    {fill(t("declineFollowOn"), { team: game.next?.battingTeam ?? "" })}
                  </button>
                </div>
              </>
            ) : upcoming && (
              <>
                <span className={styles.askTitle}>
                  {fill(t("batsNext"), { team: upcoming.battingTeam })}
                  {(previewTarget ?? upcoming.target) !== null && ` · ${t("target")} ${previewTarget ?? upcoming.target}`}
                </span>
                {game.rainRules && !opening.striker && (
                  <label className={styles.rainField}>
                    <span>{t("rainTitle")}: {t("oversThisInnings")}</span>
                    <input
                      className={styles.rainInput}
                      inputMode="numeric"
                      value={nextOvers}
                      placeholder={String(state.maxOvers ?? "")}
                      onChange={(e) => setNextOvers(e.target.value)}
                    />
                  </label>
                )}
                <span className={styles.stepTitle}>
                  {!opening.striker ? t("pickStriker") : !opening.nonStriker ? t("pickNonStriker") : t("pickBowler")}
                </span>
                <div className={styles.options}>
                  {(opening.nonStriker ? upcoming.bowling : upcoming.batting)
                    .filter((p) => p.id !== opening.striker)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={styles.option}
                        onClick={() => {
                          if (!opening.striker) setOpening({ ...opening, striker: p.id });
                          else if (!opening.nonStriker) setOpening({ ...opening, nonStriker: p.id });
                          else startInnings(p.id);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              </>
            )}
            <button type="button" className={styles.quiet} onClick={undoLast}>{t("undoLast")}</button>
          </div>
        )}

        {game.phase === "playing" && <p className={styles.sectionLabel}>{t("atTheCrease")}</p>}
        {game.phase === "playing" && striker && (
          <div className={styles.player}>
            <span className={styles.onStrike}>{striker.name}</span>
            <span className={`${styles.figures} tabular`}>
              {striker.runs} ({striker.balls})
            </span>
          </div>
        )}
        {game.phase === "playing" && nonStriker && (
          <div className={styles.player}>
            <span>{nonStriker.name}</span>
            <span className={`${styles.figures} tabular`}>
              {nonStriker.runs} ({nonStriker.balls})
            </span>
          </div>
        )}
        {game.phase === "playing" && bowler && (
          <>
            <p className={styles.sectionLabel}>{t("bowling")}</p>
            <div className={styles.player}>
              <span>{bowler.name}</span>
              <span className={`${styles.figures} tabular`}>
                {bowlerLine(bowler).replace(`${bowler.name} `, "")}
              </span>
            </div>
          </>
        )}
        <div className={styles.feedHead}>
          <p className={styles.sectionLabel} style={{ marginTop: 0 }}>
            {t("commentary")}
          </p>
          <button
            type="button"
            className={`${styles.speakToggle} ${speakOn ? styles.speakOn : ""}`}
            aria-pressed={speakOn}
            onClick={() => setSpeakOn((v) => !v)}
          >
            {speakOn ? t("speaking") : t("silent")}
          </button>
        </div>
        {feed.length === 0 ? (
          <p className={styles.feedLine}>{t("nothingCalledYet")}</p>
        ) : (
          <ul className={styles.feed}>
            {feed.map((l) => (
              <li key={l.id} className={styles.feedLine}>
                {l.text}
              </li>
            ))}
          </ul>
        )}
        {game.phase === "playing" && (
        <details className={styles.options2}>
          <summary>{t("matchOptions")}</summary>
          <div className={styles.options}>
            <button type="button" className={styles.option} onClick={undoLast} disabled={match.events.length === 0}>
              {t("undoLast")}
            </button>
            {isTest ? (
              <>
                <button type="button" className={styles.option}
                  onClick={() => record({ type: "end_innings", declared: true })}>
                  {t("declare")}
                </button>
                <button type="button" className={styles.option}
                  onClick={() => record({ type: "end_match", outcome: "draw" })}>
                  {t("endAsDraw")}
                </button>
              </>
            ) : (
              <button type="button" className={styles.option}
                onClick={() => record({ type: "end_match", outcome: "abandoned" })}>
                {t("abandonMatch")}
              </button>
            )}
          </div>
          {game.rainRules && (
            <div className={styles.rain}>
              <span className={styles.stepTitle}>{t("rainTitle")}</span>
              <label className={styles.rainField}>
                <span>{t("rainOversHelp")}</span>
                <input
                  className={styles.rainInput}
                  inputMode="numeric"
                  value={rainOvers}
                  placeholder={String(state.maxOvers ?? "")}
                  onChange={(e) => setRainOvers(e.target.value)}
                />
              </label>
              <div className={styles.options}>
                <button type="button" className={styles.option} onClick={applyRain}>
                  {t("rainReduce")}
                </button>
                <button
                  type="button"
                  className={styles.option}
                  onClick={() =>
                    record(
                      game.innings.length === 1
                        ? { type: "end_innings", rain: true }
                        : { type: "end_match", outcome: "rain" },
                    )
                  }
                >
                  {game.innings.length === 1 ? t("rainEndInnings") : t("rainEndMatch")}
                </button>
              </div>
            </div>
          )}
        </details>
        )}
      </section>

      {game.phase === "playing" && (
      <footer className={styles.foot}>
        <div className={styles.micRow}>
        <MicButton
          status={recorder.status}
          level={recorder.level}
          onStart={() => {
            // Waiting on a new bowler or batter: the prompt above says so. The
            // mic may still be turned on, it just will not take a ball yet.
            if (blocked && recorder.armed) return;
            setHint(null);
            void recorder.start();
          }}
          onStop={() => void handleStop()}
        />
        <p className={`${styles.hint} ${hint ? styles.hintError : ""}`}>
          {(recorder.status === "denied" ? t("micBlockedHelp") : recorder.error) ??
            hint ??
            (state.complete
              ? t("inningsOver")
              : waitingForBatter
                ? t("pickNewBatter")
                : waitingForBowler
                  ? t("pickNextBowler")
                  : lastBall
                    ? t("callNextBall")
                    : t("callFirstBall"))}
        </p>
        </div>
        <div className={styles.pad}>
          {PAD.map((k) => (
            <button
              key={k.label}
              type="button"
              className={`${styles.key} ${k.tone ?? ""}`}
              disabled={blocked}
              onClick={() => commitBall({ type: "ball", ...k.event }, "")}
            >
              {k.label}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.key} ${styles.keyWicket}`}
            disabled={blocked}
            onClick={() => setAsk({ partial: { type: "ball", batRuns: 0, extraRuns: 0 }, said: "" })}
          >
            W
          </button>
        </div>
      </footer>
      )}
    </main>
  );
}
