/**
 * Turns whatever the browser recorded into a WAV the speech API accepts.
 *
 * Prisma takes mp3, ogg, flac, aac, wav and m4a — and not WebM, which is
 * precisely what Chrome's MediaRecorder produces by default. Negotiating a
 * container per browser is a losing game (Chrome does WebM, Safari does mp4,
 * Firefox does Ogg, and `isTypeSupported` disagrees with all of them across
 * versions), so the browser records in whatever it likes and we decode and
 * re-encode here. Every clip leaves as the same 16 kHz mono WAV.
 *
 * 16 kHz mono is not a compromise: it is what the model wants, it is a
 * second of audio in 32 KB, and the keyterms experiment showed Prisma
 * holding up even at 8 kHz over a simulated phone line.
 */

/** The rate everything is resampled to before upload. */
export const TARGET_RATE = 16000;

/**
 * PCM samples to a WAV file.
 *
 * Pure and synchronous so it can be tested without a browser; the decoding
 * either side of it cannot be.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  ascii(8, "WAVE");

  ascii(12, "fmt ");
  view.setUint32(16, 16, true);            // PCM header length
  view.setUint16(20, 1, true);             // format: PCM
  view.setUint16(22, 1, true);             // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true);              // block align
  view.setUint16(34, 8 * bytesPerSample, true);          // bits per sample

  ascii(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling: a sample over 1.0 would wrap to full-scale
    // negative, which is an audible click exactly on the loudest shout.
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * bytesPerSample, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buffer;
}

/** Decode a recorded clip and re-encode it as 16 kHz mono WAV. */
export async function toWav(blob: Blob): Promise<Blob> {
  const bytes = await blob.arrayBuffer();

  const Ctx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(bytes);
  } finally {
    void ctx.close().catch(() => {});
  }

  const samples = await resampleToMono(decoded, TARGET_RATE);
  return new Blob([encodeWav(samples.data, samples.rate)], { type: "audio/wav" });
}

/**
 * Downmix to mono and resample.
 *
 * Some Safari versions refuse an OfflineAudioContext below their hardware
 * rate; rather than fail the ball, fall back to the clip's own rate, which
 * the API is equally happy with — it is only larger.
 */
async function resampleToMono(
  decoded: AudioBuffer,
  rate: number,
): Promise<{ data: Float32Array; rate: number }> {
  try {
    const frames = Math.max(1, Math.round(decoded.duration * rate));
    const offline = new OfflineAudioContext(1, frames, rate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return { data: rendered.getChannelData(0), rate };
  } catch {
    return { data: downmix(decoded), rate: decoded.sampleRate };
  }
}

function downmix(decoded: AudioBuffer): Float32Array {
  if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
  const out = new Float32Array(decoded.length);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const channel = decoded.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += channel[i] / decoded.numberOfChannels;
  }
  return out;
}
