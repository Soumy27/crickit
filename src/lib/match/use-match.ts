"use client";

/**
 * The match, as React sees it.
 *
 * State is derived by folding the event log on every change, which keeps the
 * engine the only place the rules live. Undo drops an event and refolds, so it
 * is exact rather than an inverse operation someone has to keep correct.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMatch, type MatchState } from "../scoring/match";
import type { BallEvent, InningsState, MatchEvent } from "../scoring/types";
import { loadMatch, saveMatch, type MatchListing, type StoredMatch } from "./store";

export interface UseMatch {
  match: StoredMatch | null;
  /** The innings in play, or the last one played. */
  state: InningsState | null;
  game: MatchState | null;
  /** Null until the first load settles, so the UI can show a real loading state. */
  loading: boolean;
  error: string | null;
  record: (event: MatchEvent) => void;
  undo: () => MatchEvent | null;
  /** The last delivery, for the confirmation chip. */
  lastBall: BallEvent | null;
  setListing: (listing: MatchListing | undefined) => void;
}

export function useMatch(id: string | null): UseMatch {
  const [match, setMatch] = useState<StoredMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const matchRef = useRef<StoredMatch | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const found = loadMatch(id);
    matchRef.current = found;
    setMatch(found);
    setLoading(false);
  }, [id]);

  const game = useMemo(() => {
    if (!match) return null;
    try {
      return buildMatch(match.setup, match.rules, match.events);
    } catch (err) {
      // A log the engine rejects means a bug, not a user mistake. Surface it
      // rather than rendering a wrong scorecard.
      setError((err as Error).message);
      return null;
    }
  }, [match]);
  const state = game?.current ?? null;

  const commit = useCallback((events: MatchEvent[]) => {
    const current = matchRef.current;
    if (!current) return;
    const next = { ...current, events };
    matchRef.current = next;
    setMatch(next);
    saveMatch(next);
  }, []);

  const record = useCallback(
    (event: MatchEvent) => {
      const current = matchRef.current;
      if (!current) return;
      try {
        // Fold before committing, so an illegal event never enters the log.
        buildMatch(current.setup, current.rules, [...current.events, event]);
      } catch (err) {
        setError((err as Error).message);
        return;
      }
      setError(null);
      commit([...current.events, event]);
    },
    [commit],
  );

  const undo = useCallback((): MatchEvent | null => {
    const current = matchRef.current;
    if (!current || current.events.length === 0) return null;
    const removed = current.events[current.events.length - 1];
    setError(null);
    commit(current.events.slice(0, -1));
    return removed;
  }, [commit]);

  const setListing = useCallback((listing: MatchListing | undefined) => {
    const current = matchRef.current;
    if (!current) return;
    const next = { ...current, listing };
    matchRef.current = next;
    setMatch(next);
    saveMatch(next);
  }, []);

  const lastBall = useMemo(() => {
    if (!match) return null;
    for (let i = match.events.length - 1; i >= 0; i--) {
      const e = match.events[i];
      if (e.type === "ball") return e;
    }
    return null;
  }, [match]);

  return { match, state, game, loading, error, record, undo, lastBall, setListing };
}
