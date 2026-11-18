/**
 * Build test/fixtures/duet16k.wav: a two-person exchange spoken by two different
 * Aura-2 voices with short silences between turns, 16 kHz mono PCM16. The live
 * and browser tests stream it to check that Nova-3 diarization splits the strip
 * by speaker in the two-people (no agent) experience.
 *   node scripts/make-duet-fixture.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* env already set */ }
const key = process.env.DEEPGRAM_API_KEY;
if (!key) { console.error('DEEPGRAM_API_KEY required'); process.exit(1); }

const RATE = 16000;
const LINES = [
  ['aura-2-thalia-en', 'Okay, so what does this booth actually do?'],
  ['aura-2-orion-en', 'It draws a comic strip out of whatever we say. Every turn becomes a panel.'],
  ['aura-2-thalia-en', 'Wait, it can tell the two of us apart?'],
  ['aura-2-orion-en', 'That is Nova three diarization. You get the beanie, I keep the glasses.'],
  ['aura-2-thalia-en', 'Honestly that is pretty cool. Does it cost much?'],
  ['aura-2-orion-en', 'Well under a cent a minute. The meter in the corner is the real bill.'],
];
const silence = (ms) => Buffer.alloc((RATE * 2 * ms) / 1000);
const parts = [silence(600)];
for (const [model, text] of LINES) {
  const res = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&sample_rate=${RATE}&container=none`, { method: 'POST', headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error(`speak ${res.status}: ${await res.text()}`);
  parts.push(Buffer.from(await res.arrayBuffer()), silence(1400));
  console.log(`${model}: "${text}"`);
}
const pcm = Buffer.concat(parts);
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
const out = path.join(ROOT, 'test', 'fixtures', 'duet16k.wav');
fs.writeFileSync(out, Buffer.concat([header, pcm]));
console.log(`wrote ${out} (${(pcm.length / (RATE * 2)).toFixed(1)} s)`);
