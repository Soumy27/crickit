"use client";

/**
 * The app's chosen language.
 *
 * Kept in localStorage and read through useSyncExternalStore rather than
 * useState, because the server has no localStorage: the server snapshot is
 * English and the client's is whatever the scorer picked, and that hook is
 * the one built to let those two disagree without a hydration warning.
 *
 * This is the language of the *interface* only. Speech recognition stays on
 * `indic-auto` — the whole point is that a scorer reading a Kannada app can
 * still shout in Hindi, and often will.
 */

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { translate, type StringKey, type UiLanguage } from "./strings";

const KEY = "crickit.language";
const DEFAULT: UiLanguage = "en-IN";

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  // Another tab changing it should move this one too.
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    // Private windows and blocked site data both throw here.
    return null;
  }
}

function clientSnapshot(): string {
  return readStored() ?? "";
}

/** "" means nothing has been chosen — the picker should be shown. */
function serverSnapshot(): string {
  return "";
}

export function setLanguage(language: UiLanguage) {
  try {
    localStorage.setItem(KEY, language);
  } catch {
    // Not fatal: the choice simply will not survive a reload.
  }
  listeners.forEach((fn) => fn());
}

export interface Language {
  /** The chosen language, or English while nothing has been chosen. */
  language: UiLanguage;
  /** False until the scorer has picked one, which is when the picker shows. */
  chosen: boolean;
  set: (language: UiLanguage) => void;
  /** Look up a string in the current language. */
  t: (key: StringKey) => string;
}

const Ctx = createContext<Language | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const language = (stored || DEFAULT) as UiLanguage;
  const chosen = stored !== "";

  const t = useCallback((key: StringKey) => translate(language, key), [language]);
  const value = useMemo<Language>(
    () => ({ language, chosen, set: setLanguage, t }),
    [language, chosen, t],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage(): Language {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLanguage needs a LanguageProvider above it.");
  return ctx;
}

/** The common case: just the lookup function. */
export function useT(): (key: StringKey) => string {
  return useLanguage().t;
}
