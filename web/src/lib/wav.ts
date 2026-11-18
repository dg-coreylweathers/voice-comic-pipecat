/** Mixes a 16 kHz mic track and 24 kHz agent chunks into one 24 kHz mono WAV. */
export interface TimedChunk { t: number; pcm: Int16Array }

export const MAX_RECORDING_MS = 8 * 60_000;
const RATE = 24000;

export function mixToWav(mic: TimedChunk[], agent: TimedChunk[], durationMs: number, maxMs = MAX_RECORDING_MS): Blob {
  const total = Math.ceil((Math.min(durationMs, maxMs) / 1000) * RATE);
  const buf = new ArrayBuffer(44 + total * 2);
  const out = new Int16Array(buf, 44, total);
  for (const c of mic) placeUpsampled(out, c.pcm, Math.round((c.t / 1000) * RATE), 1.5);
  for (const c of agent) place(out, c.pcm, Math.round((c.t / 1000) * RATE));
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, total * 2, true);
  return new Blob([buf], { type: 'audio/wav' });
}

const clamp = (x: number) => (x > 32767 ? 32767 : x < -32768 ? -32768 : x);

function place(out: Int16Array, pcm: Int16Array, at: number) {
  const start = Math.max(0, at), end = Math.min(out.length, at + pcm.length);
  for (let i = start; i < end; i++) out[i] = clamp(out[i] + pcm[i - at]);
}

/** Linear-interpolation upsample straight into the destination (16 kHz -> 24 kHz is ratio 1.5). */
function placeUpsampled(out: Int16Array, pcm: Int16Array, at: number, ratio: number) {
  const n = Math.floor(pcm.length * ratio);
  const start = Math.max(0, at), end = Math.min(out.length, at + n);
  for (let i = start; i < end; i++) {
    const x = (i - at) / ratio, i0 = x | 0, i1 = i0 + 1 < pcm.length ? i0 + 1 : i0, f = x - i0;
    out[i] = clamp(out[i] + Math.round(pcm[i0] * (1 - f) + pcm[i1] * f));
  }
}
