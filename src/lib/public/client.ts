"use client";

/**
 * Keeps a public match up to date in the background.
 *
 * Scoring never waits on any of this. The ball is already safe on the phone by
 * the time this runs; a failed request only means the public page is behind, and
 * the next ball, the network coming back, or the retry timer catches it up.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { StringKey } from "../i18n/strings";
import type { MatchListing, StoredMatch } from "../match/store";
import { coarsePlace, type Place } from "./geo";

export type SyncStatus = "idle" | "saving" | "saved" | "waiting" | "gone" | "refused";

const DEBOUNCE_MS = 1500;
const RETRY_MS = 20_000;

function payloadOf(match: StoredMatch) {
  return { setup: match.setup, rules: match.rules, events: match.events };
}

export function usePublicSync(
  match: StoredMatch | null,
  setListing: (listing: MatchListing | undefined) => void,
): { status: SyncStatus; message: string | null } {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef(match);
  latest.current = match;
  const inFlight = useRef(false);
  const again = useRef(false);

  const push = useCallback(async () => {
    const current = latest.current;
    const listing = current?.listing;
    if (!current || !listing?.wanted) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    setStatus("saving");
    try {
      const res = listing.code
        ? await fetch(`/api/public/matches/${listing.code}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${listing.token}` },
            body: JSON.stringify(payloadOf(current)),
          })
        : await fetch("/api/public/matches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payloadOf(current),
              venue: current.venue,
              startedAt: current.startedAt,
              lat: listing.lat,
              lng: listing.lng,
              tournament: listing.tournament,
            }),
          });

      if (res.ok) {
        if (!listing.code) {
          const { code, token } = (await res.json()) as { code: string; token: string };
          setListing({ ...listing, code, token });
        }
        setStatus("saved");
        setMessage(null);
      } else if (res.status === 404) {
        // Removed elsewhere. Do not quietly put it back.
        setStatus("gone");
      } else if (res.status === 400 || res.status === 403) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus("refused");
        setMessage(error ?? null);
      } else {
        setStatus("waiting");
      }
    } catch {
      setStatus("waiting");
    } finally {
      inFlight.current = false;
      if (again.current) {
        again.current = false;
        void push();
      }
    }
  }, [setListing]);

  const eventCount = match?.events.length;
  const wanted = match?.listing?.wanted;

  useEffect(() => {
    if (!wanted) {
      setStatus("idle");
      return;
    }
    const timer = setTimeout(() => void push(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [eventCount, wanted, push]);

  useEffect(() => {
    if (status !== "waiting") return;
    const retry = () => void push();
    window.addEventListener("online", retry);
    const timer = setInterval(retry, RETRY_MS);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(timer);
    };
  }, [status, push]);

  return { status, message };
}

export type LocateState = "idle" | "locating" | "denied" | "unavailable";

/** Asks only when pressed, and rounds off before anything else sees the position. */
export function useLocate() {
  const [state, setState] = useState<LocateState>("idle");

  const locate = useCallback((): Promise<Place | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unavailable");
      return Promise.resolve(null);
    }
    setState("locating");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState("idle");
          resolve(coarsePlace({ lat: position.coords.latitude, lng: position.coords.longitude }));
        },
        (error) => {
          setState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
      );
    });
  }, []);

  return { locate, state };
}

export const LOCATE_MESSAGES: Record<LocateState, StringKey | null> = {
  idle: null,
  locating: "locating",
  denied: "locationDenied",
  unavailable: "locationUnavailable",
};

/** The tournament's scorer key, on the organiser's and scorers' own devices. */
const KEY_PREFIX = "crickit.tournament.";

export function rememberTournamentKey(code: string, key: string) {
  try {
    localStorage.setItem(KEY_PREFIX + code, key);
  } catch {
    // Blocked storage: the scorer link still works each time it is opened.
  }
}

export function tournamentKey(code: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + code);
  } catch {
    return null;
  }
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
