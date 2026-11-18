import { useEffect, useState } from 'react';
import { Strip } from '../comic/Strip';
import type { ExperienceKey, Panel } from '../lib/types';

const BEAT_MS = 2500;
const u = (id: string, text: string, extra: Partial<Panel> = {}): Panel => ({ id, role: 'user', text, final: true, startedAt: 0, endedAt: 2000, model: 'flux-general-en', version: 'v2', ...extra });
const g = (id: string, text: string, extra: Partial<Panel> = {}): Panel => ({ id, role: 'agent', text, final: true, startedAt: 2000, spokenAt: 2400, endedAt: 5000, model: 'flux-kit-en', version: 'v2', spokenChars: text.length, ...extra });

/** Twelve seconds, five beats: talk, answer, interrupt, redact, two people. Rendered with the real strip so what visitors see idle is what they get live. */
export const BEATS: { title: string; panels: Panel[]; layout?: ExperienceKey }[] = [
  { title: 'You talk. It draws you.', panels: [u('a1', 'Hey Flux, draw me something…', { final: false, endedAt: undefined }), g('a2', '', { final: false, spokenChars: 0 })] },
  { title: 'It answers, in its own voice.', panels: [u('b1', 'Hey Flux, draw me something cool!', { intel: { sentiment: 'positive', score: 0.5, intents: [], topics: [] } }), g('b2', 'Already drawn. Try to interrupt me.', { latencyMs: 480 })] },
  { title: 'Interrupt it. The bubble tears.', panels: [g('c1', 'I could talk about turn detection all day, but you probably have questions about', { interruptedAt: 44, spokenChars: 44, latencyMs: 520 }), u('c2', 'WAIT. Can you hide my card number?', { paceWps: 3.9, intel: { sentiment: 'neutral', score: 0.0, intents: [], topics: [] } })] },
  { title: 'Secrets never reach the page.', panels: [u('d1', 'Sure, it is [CREDIT_CARD_1] and I am [NAME_GIVEN_1].', { model: 'nova-3', version: 'v1', redacted: true }), g('d2', 'Never saw it. Nova-3 blacked it out before it got here.', { latencyMs: 610 })] },
  { title: 'Two of you? Nova-3 tells you apart.', layout: 'duet', panels: [u('e1', 'Wait, it can tell the two of us apart?', { model: 'nova-3', version: 'v1', speaker: 0 }), u('e2', 'Diarization. You get the beanie, I keep the glasses.', { model: 'nova-3', version: 'v1', speaker: 1, startedAt: 2000, endedAt: 4000 })] },
];

export function Attract() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setI(1); return; } // one static beat
    let t: number | null = null;
    const run = () => { if (t == null && document.visibilityState === 'visible') t = window.setInterval(() => setI((n) => (n + 1) % BEATS.length), BEAT_MS); };
    const halt = () => { if (t != null) { clearInterval(t); t = null; } };
    const onVis = () => (document.visibilityState === 'visible' ? run() : halt());
    run();
    document.addEventListener('visibilitychange', onVis);
    return () => { halt(); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  const beat = BEATS[i];
  return (
    <div className="attract" aria-hidden="true">
      <div className="attract-title" key={`t${i}`}>{beat.title}</div>
      <div className="attract-strip" key={`s${i}`}><Strip panels={beat.panels} showTags={false} layout={beat.layout} /></div>
      <div className="attract-dots">{BEATS.map((_, n) => <i key={n} className={n === i ? 'on' : ''} />)}</div>
    </div>
  );
}
