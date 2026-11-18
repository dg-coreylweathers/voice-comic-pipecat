import type { Panel } from './types';

export type Expression = 'neutral' | 'talking' | 'happy' | 'upset' | 'surprised' | 'thinking';
/** The cast's colours: the visitor is coral, Flux is Deepgram green. */
export const ACCENT = { user: '#ff7a59', user2: '#8b5cf6', agent: '#13ef95' } as const;

/** An agent panel that exists but has produced no speech yet. */
/** A turn counts as happy or upset beyond this |sentiment score|; the face, the labels and the themes cloud all use it. */
export const MOOD_THRESHOLD = 0.15;
export const moodOf = (score: number): 'happy' | 'upset' | null => (score > MOOD_THRESHOLD ? 'happy' : score < -MOOD_THRESHOLD ? 'upset' : null);

export const isThinking = (panel: Panel, agentSpeaking: boolean) => panel.role === 'agent' && !panel.final && !agentSpeaking && (panel.spokenChars ?? 0) === 0;
export type BubbleStyle = 'normal' | 'shout' | 'calm';

/** Turns model signals (sentiment, pace, interruption, redaction) into comic choices. */
export function direct(panel: Panel, agentSpeaking = false) {
  const score = panel.intel?.score ?? 0;
  const sentiment = panel.intel?.sentiment ?? 'neutral';
  let expression: Expression = 'neutral';
  if (!panel.final) expression = 'talking';
  else if (panel.interruptedAt != null) expression = 'surprised';
  else if (sentiment === 'positive' && moodOf(score) === 'happy') expression = 'happy';
  else if (sentiment === 'negative' && moodOf(score) === 'upset') expression = 'upset';
  if (isThinking(panel, agentSpeaking)) expression = 'thinking';

  const pace = panel.paceWps ?? 0;
  const bubble: BubbleStyle = pace > 3.4 || (panel.intel && Math.abs(score) > 0.6) ? 'shout' : pace > 0 && pace < 1.7 ? 'calm' : 'normal';

  // Background hue: warm for positive, cool for negative, cream when neutral.
  const intensity = Math.min(1, Math.abs(score));
  const bg = sentiment === 'positive' ? mix('#fff6d5', '#ffd166', intensity) : sentiment === 'negative' ? mix('#e9eefc', '#7aa2f7', intensity) : '#f6f1e7';
  const accent = panel.role === 'user' && (panel.speaker ?? 0) > 0 ? ACCENT.user2 : ACCENT[panel.role];

  let sfx: string | null = null;
  if (panel.interruptedAt != null) sfx = '!';
  else if (panel.redacted) sfx = 'REDACTED';
  else if (panel.final && score > 0.6) sfx = 'WOW!';
  else if (panel.final && score < -0.6) sfx = 'UGH';
  else if (panel.final && pace > 3.6) sfx = 'ZOOM';

  const caption = panel.intel?.topics?.[0] ? `re: ${panel.intel.topics[0]}` : panel.intel?.intents?.[0] ?? null;
  return { expression, bubble, bg, accent, sfx, caption };
}

/** Blend two #rrggbb colours; t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number) {
  const pa = hex(a), pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export type LabelTone = 'ok' | 'alert' | 'info' | 'mood';
export interface MicroLabel { text: string; tone: LabelTone }

/** Plain words for the model name a passer-by would recognise. */
export function prettyModel(model: string) {
  if (model.startsWith('flux-general')) return 'Flux';
  if (model.startsWith('nova')) return 'Nova-3';
  if (model.startsWith('aura')) return 'Aura-2';
  if (model.startsWith('flux')) return 'Flux TTS';
  return model;
}

/**
 * Micro-labels: what just happened, in plain language, for someone reading the
 * panel from three metres away. Most notable first, at most two per panel.
 * `prevModel` is the model of the previous panel on the same side; `prevSpeaker`
 * the diarized speaker of the previous visitor panel, so a hand-off is called out.
 */
export function labels(panel: Panel, prevModel?: string, agentSpeaking = false, prevSpeaker?: number): MicroLabel[] {
  const out: MicroLabel[] = [];
  const score = panel.intel?.score ?? 0;
  // Only a change a passer-by would recognise counts: Flux -> Nova-3, Flux TTS -> Aura-2. Voices within a family stay quiet.
  const switched = prevModel && prettyModel(prevModel) !== prettyModel(panel.model) ? { text: `switched to ${prettyModel(panel.model)}`, tone: 'info' as const } : null;
  if (panel.role === 'agent') {
    if (!panel.final) out.push(isThinking(panel, agentSpeaking) ? { text: 'thinking…', tone: 'info' } : { text: 'speaking', tone: 'ok' });
    if (panel.interruptedAt != null) out.push({ text: 'you interrupted', tone: 'alert' });
    if (switched) out.push(switched);
    if (panel.final && panel.latencyMs != null) out.push({ text: `replied in ${(panel.latencyMs / 1000).toFixed(1)}s`, tone: 'ok' });
  } else {
    if (!panel.final) out.push({ text: 'listening…', tone: 'info' });
    if (panel.redacted) out.push({ text: 'redacted', tone: 'alert' });
    if (prevSpeaker != null && panel.speaker != null && panel.speaker !== prevSpeaker) out.push({ text: 'new voice', tone: 'info' }); // Nova-3 diarization noticed the hand-off
    if (switched) out.push(switched);
    if (panel.final && !out.length) out.push({ text: 'heard you', tone: 'ok' });
    const mood = panel.final ? moodOf(score) : null;
    if (mood) out.push({ text: `sounded ${mood}`, tone: 'mood' });
  }
  return out.slice(0, 2);
}

/** Deepgram redaction markers become censor bars; the grammar is shared with the server in shared/redaction.js. */
export { REDACTION_RE, hasRedaction } from '../../../shared/redaction.js';

/** Speaking rate used to reveal robot bubbles, live and in replay. */
export const REVEAL_CPS = 15;
/** How many characters of an agent panel have been "spoken" at session time t. */
export function revealedChars(p: Panel, t: number): number {
  if (p.role !== 'agent') return p.text.length;
  if (p.final) return p.interruptedAt ?? p.text.length;
  if (p.spokenAt == null || t < p.spokenAt) return 0;
  return Math.min(p.text.length, Math.floor(((t - p.spokenAt) / 1000) * REVEAL_CPS));
}
