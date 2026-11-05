/**
 * How much voice one connection and the whole site may use.
 *
 * A twenty-over match is about 260 balls over three hours, so around 90 calls an
 * hour, and each call may also speak its commentary. One connection can be a
 * whole college wifi or a mobile network's shared address, so the hourly figure
 * leaves room for several matches at once. Both can be changed in the host's
 * settings without touching code.
 */

export type VoiceKind = "stt" | "tts";

export const VOICE_HOURLY_DEFAULT = 300;
export const VOICE_DAILY_DEFAULT = 2000;

export function limitFromEnv(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function hourStart(now: Date): string {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function dayStart(now: Date): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** `everyone` is null when the connection was already over and was not counted. */
export function decideVoice(
  counted: { mine: number; everyone: number | null },
  limits: { hourly: number; daily: number },
): "connection" | "everyone" | null {
  if (counted.mine > limits.hourly) return "connection";
  if (counted.everyone !== null && counted.everyone > limits.daily) return "everyone";
  return null;
}
