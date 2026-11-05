"use client";

import { useEffect, useRef } from "react";
import type { RecorderStatus } from "@/lib/audio/use-recorder";
import { useT } from "@/lib/i18n/use-language";
import type { StringKey } from "@/lib/i18n/strings";
import styles from "./scoring.module.css";

/** The ellipsis is the same in every language, so it is not a string. */
const LABEL: Record<RecorderStatus, StringKey | null> = {
  idle: "tapToTurnOn",
  asking: "allowMic",
  ready: "holdToTalk",
  recording: "listening",
  thinking: null,
  denied: "micBlocked",
  unsupported: "noMic",
  error: "retry",
};

/**
 * Press and hold for one delivery.
 *
 * Pointer events rather than touch or mouse, so a stylus and a trackpad work
 * too, and `pointercancel` is handled — on a phone a scroll or an incoming
 * call steals the pointer mid-ball, and a recorder left running would
 * swallow the next one.
 *
 * One press must produce exactly one start and one stop; `held` is the latch
 * that makes the pair symmetrical.
 */
export function MicButton({
  status,
  level,
  onStart,
  onStop,
}: {
  status: RecorderStatus;
  level: number;
  onStart: () => void;
  onStop: () => void;
}) {
  const t = useT();
  const held = useRef(false);

  const busy = status === "thinking" || status === "asking";
  const blocked = status === "denied" || status === "unsupported";
  const recording = status === "recording";

  // The permission dialog swallows the release, so the press ends here instead.
  useEffect(() => {
    if (status === "asking") held.current = false;
  }, [status]);

  const press = () => {
    if (held.current || busy || blocked) return;
    held.current = true;
    onStart();
  };

  const release = () => {
    if (!held.current) return;
    held.current = false;
    onStop();
  };

  return (
    <div className={styles.micWrap}>
      {recording && (
        <span
          className={styles.ring}
          style={{ "--level": 1 + level * 0.45 } as React.CSSProperties}
          aria-hidden
        />
      )}
      <button
        type="button"
        className={[
          styles.mic,
          recording ? styles.micRecording : "",
          busy ? styles.micThinking : "",
          blocked ? styles.micDisabled : "",
        ].join(" ")}
        // aria-disabled, not disabled: a disabled button never receives the
        // pointerup, which left the latch stuck and the next press ignored.
        aria-disabled={busy || blocked}
        aria-label={recording ? t("listening") : t(LABEL[status] ?? "holdToTalk")}
        aria-pressed={recording}
        onPointerDown={(e) => {
          e.preventDefault();
          // Capture keeps the pointer on this button if the thumb slides,
          // which on a phone held one-handed it always does.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Not fatal: without capture a slide off the button cancels it.
          }
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        // Space and Enter for a keyboard, which is also how a desktop scorer works.
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            press();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            release();
          }
        }}
        onBlur={release}
      >
        {/* Two short words in English, one long one in Malayalam — let the
            label wrap rather than hand-breaking it per language. */}
        <span className={styles.micLabel}>
          {LABEL[status] ? t(LABEL[status]) : "…"}
        </span>
      </button>
    </div>
  );
}
