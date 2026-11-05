/**
 * The WAV header has to be right or the speech API rejects the ball, and a
 * wrong header is invisible until it is a scorer standing at a ground.
 */
import { describe, expect, it } from "vitest";
import { encodeWav } from "./to-wav";

function read(buf: ArrayBuffer) {
  const view = new DataView(buf);
  const text = (o: number, n: number) =>
    String.fromCharCode(...new Uint8Array(buf, o, n));
  return {
    riff: text(0, 4),
    size: view.getUint32(4, true),
    wave: text(8, 4),
    fmt: text(12, 4),
    audioFormat: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bits: view.getUint16(34, true),
    data: text(36, 4),
    dataSize: view.getUint32(40, true),
    sampleAt: (i: number) => view.getInt16(44 + i * 2, true),
  };
}

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM header the API will accept", () => {
    const w = read(encodeWav(new Float32Array(160), 16000));
    expect(w.riff).toBe("RIFF");
    expect(w.wave).toBe("WAVE");
    expect(w.fmt).toBe("fmt ");
    expect(w.data).toBe("data");
    expect(w.audioFormat).toBe(1);
    expect(w.channels).toBe(1);
    expect(w.sampleRate).toBe(16000);
    expect(w.bits).toBe(16);
    expect(w.blockAlign).toBe(2);
    expect(w.byteRate).toBe(32000);
  });

  it("declares the sizes the sample count implies", () => {
    const w = read(encodeWav(new Float32Array(1000), 16000));
    expect(w.dataSize).toBe(2000);
    expect(w.size).toBe(36 + 2000);
  });

  it("carries the sample rate it was given", () => {
    expect(read(encodeWav(new Float32Array(8), 44100)).sampleRate).toBe(44100);
  });

  it("maps the full range without wrapping at the extremes", () => {
    const w = read(encodeWav(new Float32Array([0, 1, -1, 0.5, -0.5]), 16000));
    expect(w.sampleAt(0)).toBe(0);
    expect(w.sampleAt(1)).toBe(32767);
    expect(w.sampleAt(2)).toBe(-32768);
    expect(w.sampleAt(3)).toBe(16383);
    expect(w.sampleAt(4)).toBe(-16384);
  });

  it("clamps a sample past full scale instead of letting it wrap", () => {
    // Without the clamp this is the loudest shout turning into a click.
    const w = read(encodeWav(new Float32Array([1.8, -1.8]), 16000));
    expect(w.sampleAt(0)).toBe(32767);
    expect(w.sampleAt(1)).toBe(-32768);
  });
});
