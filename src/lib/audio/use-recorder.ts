"use client";

/**
 * Hold-to-talk for one delivery.
 *
 * The stream is opened once and kept, because a scorer presses this ~150
 * times an innings and re-requesting the microphone each time costs latency
 * and flashes the browser's recording indicator on every ball.
 *
 * An utterance is about a second, so REST is used rather than streaming: well
 * inside the 30-second limit, and releasing the button gives a clean
 * utterance boundary, which is exactly one ball.
 *
 * Three things here exist because of bugs in this path:
 *
 *  1. The first press only opens the mic: the permission dialog takes the
 *     pointer, so there is no hold to record. Holding works from the second.
 *  2. A stop can arrive twice for one press (pointerup, then the pointer
 *     capture releasing). The second one must be a no-op, not a failure.
 *  3. Prisma does not accept WebM, which is exactly what Chrome records, so
 *     voice scoring never worked in Chrome at all. Every clip is now decoded
 *     and re-encoded as a 16 kHz mono WAV before it leaves the browser —
 *     see to-wav.ts for why that beats negotiating a container per browser.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toWav } from "./to-wav";

export type RecorderStatus =
  | "idle"        // no stream yet; the mic has not been asked for
  | "asking"      // permission prompt is up
  | "ready"
  | "recording"
  | "thinking"    // uploaded, waiting on Prisma
  | "denied"
  | "unsupported"
  | "error";

/** Why `stop()` came back without a clip. */
export type StopReason =
  /** The mic was still opening — this press was spent arming it. */
  | "arming"
  /** A tap rather than a hold: no speech in it. */
  | "too_short"
  /** The clip would not decode, so there is nothing to send. */
  | "unreadable"
  /** Nothing was recording. A duplicate stop for one press lands here. */
  | "not_recording";

export interface Clip {
  /** Always a 16 kHz mono WAV, whatever the browser recorded. */
  blob: Blob;
  mimeType: "audio/wav";
  filename: "ball.wav";
}

export interface Recorder {
  status: RecorderStatus;
  error: string | null;
  /** Peak level 0–1 while recording, for the level meter. */
  level: number;
  /** True once the microphone is open and a hold will actually record. */
  armed: boolean;
  /** Open the microphone without recording, so the first ball is not lost. */
  arm: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<{ clip: Clip | null; reason?: StopReason }>;
  /** Back to ready once the caller has finished with the clip. */
  settle: () => void;
  /** Release the microphone — call when leaving the scoring screen. */
  release: () => void;
}

/** Safari does not do webm; mp4 is its working container. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const type of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

/**
 * Below this a clip holds no speech. Deliberately low: it is a guard against
 * an accidental tap, not a quality bar, and a shouted "four!" into a phone
 * compresses very small.
 */
const MIN_BYTES = 600;
/** And below this many milliseconds it was a tap, whatever the byte count. */
const MIN_MS = 250;

export function useRecorder(): Recorder {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [armed, setArmed] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef(0);

  /** Whether the mic has ever been open, so "arming" is reported only once. */
  const armedOnce = useRef(false);
  /** The in-flight start, so a stop can wait for it instead of missing it. */
  const starting = useRef<Promise<void> | null>(null);
  /** Set by stop() so a start still waiting on permission does not run on. */
  const stopWanted = useRef(false);

  const release = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    recorderRef.current = null;
    analyserRef.current = null;
    void contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
    setArmed(false);
    setLevel(0);
  }, []);

  useEffect(() => release, [release]);

  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError(
        typeof window !== "undefined" && !window.isSecureContext
          ? "The microphone needs a secure page. Open this over HTTPS, or on localhost."
          : "This browser cannot record audio. Try Chrome or Safari.",
      );
      return null;
    }
    if (!pickMimeType()) {
      setStatus("unsupported");
      setError("This browser cannot record in a format we can send.");
      return null;
    }

    setStatus("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // A maidan is loud and the phone is in a pocket half the time.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        contextRef.current = ctx;
        analyserRef.current = analyser;
      }

      setStatus("ready");
      setArmed(true);
      setError(null);
      return stream;
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("denied");
        setError("Microphone blocked. Allow it in your browser settings to score by voice.");
      } else if (name === "NotFoundError") {
        setStatus("error");
        setError("No microphone found.");
      } else {
        setStatus("error");
        setError("Could not open the microphone.");
      }
      return null;
    }
  }, []);

  const arm = useCallback(async () => {
    const stream = await ensureStream();
    return !!stream;
  }, [ensureStream]);

  const watchLevel = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
      setLevel(peak);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    // A second press while one is already live would orphan the first
    // recorder on the same stream and lose the ball being spoken into it.
    if (recorderRef.current) return;

    stopWanted.current = false;
    const run = (async () => {
      // A press with no open mic only opens the mic. The permission dialog
      // takes the pointer away, so nobody is still holding when it resolves;
      // recording from there would capture a clip no one asked for.
      if (!streamRef.current) {
        await ensureStream();
        return;
      }
      const stream = streamRef.current;
      if (stopWanted.current) return;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAt.current = performance.now();
      setStatus("recording");
      watchLevel();
    })();

    starting.current = run;
    await run;
    if (starting.current === run) starting.current = null;
  }, [ensureStream, watchLevel]);

  const stop = useCallback(async (): Promise<{ clip: Clip | null; reason?: StopReason }> => {
    stopWanted.current = true;
    // The press may have been shorter than the permission dialog, or than a
    // single microtask. Let the start it belongs to finish first.
    if (starting.current) await starting.current;

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      // Either the mic was still opening — this press bought the permission —
      // or this is the duplicate stop that one press can produce.
      const reason: StopReason = streamRef.current && !armedOnce.current ? "arming" : "not_recording";
      armedOnce.current = !!streamRef.current;
      setStatus(streamRef.current ? "ready" : "idle");
      return { clip: null, reason };
    }
    armedOnce.current = true;

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setLevel(0);

    const heldMs = performance.now() - startedAt.current;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });

    recorderRef.current = null;

    if (blob.size < MIN_BYTES || heldMs < MIN_MS) {
      setStatus("ready");
      return { clip: null, reason: "too_short" };
    }

    setStatus("thinking");
    try {
      const wav = await toWav(blob);
      return { clip: { blob: wav, mimeType: "audio/wav", filename: "ball.wav" } };
    } catch {
      setStatus("ready");
      return { clip: null, reason: "unreadable" };
    }
  }, []);

  const settle = useCallback(() => {
    setStatus(streamRef.current ? "ready" : "idle");
  }, []);

  return { status, error, level, armed, arm, start, stop, settle, release };
}
