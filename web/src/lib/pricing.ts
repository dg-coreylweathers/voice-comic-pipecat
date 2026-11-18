import type { Catalog, Panel, SpeakModel, Tier, Usage } from './types';

export interface CostLine { key: string; label: string; amount: number; regular?: number; note: string; color: string }
export interface CostBreakdown {
  bundled: CostLine[]; alaCarte: CostLine[]; bundledTotal: number; alaCarteTotal: number;
  /** Agent connection minutes, or STT minutes in a duet (there is no agent to bill). */
  minutes: number;
  /** The same span in ms, for m:ss display. */
  talkMs: number;
  /** What an hour of this conversation would cost at the metered rate; null before anything is metered. */
  hourly: number | null;
  /** True while the launch promo rates apply (Voice Agent tiers, Flux TTS). */
  promo: boolean;
  duet: boolean;
}

const perMin = (ms: number) => ms / 60000;

export const COLORS = {
  agentStandard: '#13ef95',
  agentAdvanced: '#0aa869',
  stt: '#7aa2f7',
  tts: '#ff7a59',
  addon: '#ffd166',
  llm: '#8fa1b8',
  included: '#8b5cf6',
};

/*
 * How the demo talks about money. Voice AI list prices are quoted per minute
 * and per thousand characters, which makes a single turn cost a fraction of a
 * cent and a single conversation a few cents. Nobody budgets in those units, so
 * every number the UI shows is translated first:
 *  - money is whole cents ("8¢"), never "$0.0047"; under half a cent reads "<1¢"
 *  - time is m:ss ("1:32"), never "1.53 min"
 *  - a per-minute rate is shown next to its hourly figure ("$0.056/min, $3.36/hr"),
 *    which is how the pricing page's own FAQ answers "how much per hour"
 *  - a single panel's cost is shown as a thousand of that panel, because one is
 *    meaningless and a thousand is a budget line
 */

/** Whole-cent money: "0¢", "<1¢", "8¢", "$1.24". */
export const price = (n: number) => {
  if (n <= 0) return '0¢';
  const c = Math.round(n * 100); // decide the unit from the rounded cent count so the boundary cannot disagree with the formatting
  if (c < 1) return '<1¢';
  if (c < 100) return `${c}¢`;
  return `$${(c / 100).toFixed(2)}`;
};
/** Talk time as m:ss: "0:42", "1:32", "12:05". */
export const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** A per-minute rate as the hourly figure people budget with: 0.056 → "$3.36/hr". */
export const perHour = (ratePerMin: number) => `$${(ratePerMin * 60).toFixed(2)}/hr`;
/** Both readings of a per-minute rate: "$0.056/min ($3.36/hr)". */
export const rateBoth = (ratePerMin: number) => `$${ratePerMin}/min (${perHour(ratePerMin)})`;
/** What `n` of this would cost: whole dollars once it is real money, whole cents below that. */
export const atScale = (amount: number, n = 1000) => { const t = amount * n; return t >= 10 ? `$${Math.round(t).toLocaleString('en-US')}` : price(t); };

/** The pricing page's "through 9/14" promo covers that whole day (US Pacific, Deepgram's billing day); from the next day the meter quotes the regular rate. */
const promoEndsAt = new Map<string, number>();
export function promoActive(catalog: Catalog, now = Date.now()) {
  const key = catalog.rates.promoEnds;
  let at = promoEndsAt.get(key);
  if (at == null) { at = Date.parse(`${key}T23:59:59-07:00`); promoEndsAt.set(key, at); }
  return now <= at;
}
/** Voice Agent per-minute rate for an LLM tier at time `now`. */
export const agentRate = (catalog: Catalog, tier: Tier, now = Date.now()) => { const t = catalog.rates.agentPerMinByTier[tier]; return promoActive(catalog, now) ? t.promo : t.regular; };
/** TTS rate per 1k characters at time `now` (Flux TTS is free during the promo, then its regular rate). */
export const ttsRate = (catalog: Catalog, m: SpeakModel, now = Date.now()) => (m.regularPer1k != null && !promoActive(catalog, now) ? m.regularPer1k : m.ratePer1k);
/**
 * Two views of the same conversation:
 *  - bundled: what this demo actually incurs. The Voice Agent API bills per
 *    minute of WebSocket connection at a rate set by the LLM tier, and that
 *    covers STT + LLM + TTS. The transcript layer is a second STT stream
 *    billed per minute of audio. In a duet there is no agent: the Nova-3
 *    stream (diarization included) is the whole bill.
 *  - à la carte: what the same STT minutes and TTS characters would cost if
 *    you composed the models yourself (your LLM bill comes on top). The STT
 *    line follows the model the strip was actually drawn from: the model you
 *    selected, or Nova-3 when Redact or Two speakers made it necessary.
 * Promo vs regular is decided by when the session ended, so a strip recorded
 * under the promo replays at the rates it was billed at.
 */
export function computeCost(usage: Usage, catalog: Catalog, now = Date.now()): CostBreakdown {
  const end = usage.disconnectedAt ?? now;
  const r = catalog.rates;
  const duet = usage.experience === 'duet';
  const promo = promoActive(catalog, end);
  const tiers = usage.agentMsByTier ?? {};
  let agentMs = Object.values(tiers).reduce((a, b) => a + b, 0);
  // Strips saved before tiers (and experiences) were metered: fall back to connection time on the standard tier. Anything newer always has tier accounting, and a duet has none.
  if (usage.experience == null && agentMs === 0 && usage.connectedAt) agentMs = Math.max(0, end - usage.connectedAt);

  const bundled: CostLine[] = [];
  // Agent minutes are billed whenever they exist, even if the session ended as a duet after a scene switch.
  for (const [tier, ms] of Object.entries(Object.keys(tiers).length ? tiers : { standard: agentMs })) {
    const rate = r.agentPerMinByTier[tier as Tier];
    if (!rate || ms <= 0) continue;
    const mins = perMin(ms);
    const perMinute = agentRate(catalog, tier as Tier, end);
    bundled.push({ key: `agent-${tier}`, label: `Voice Agent API · ${rate.label} tier`, amount: mins * perMinute, regular: mins * rate.regular, note: `${mmss(ms)} connected at ${rateBoth(perMinute)}${promo ? `, promo through ${r.promoEnds}` : ''} · STT + LLM + TTS in one socket`, color: tier === 'advanced' ? COLORS.agentAdvanced : COLORS.agentStandard });
  }
  const alaCarte: CostLine[] = [];
  let layerMs = 0;
  for (const [key, ms] of Object.entries(usage.listenMsByKey)) {
    const m = catalog.listen.find((l) => l.key === key);
    if (!m || ms <= 0) continue;
    layerMs += ms;
    const mins = perMin(ms);
    const line: CostLine = { key: `stt-${key}`, label: `${m.label}`, amount: mins * m.ratePerMin, regular: m.regularPerMin ? mins * m.regularPerMin : undefined, note: `${mmss(ms)} of audio at ${rateBoth(m.ratePerMin)}`, color: COLORS.stt };
    bundled.push(duet ? line : { ...line, label: `Transcript layer · ${m.label}` });
    alaCarte.push(line);
  }
  if (duet && layerMs > 0) { const l: CostLine = { key: 'diarize', label: 'Speaker diarization', amount: perMin(layerMs) * (r.diarizationPerMin ?? 0), note: (r.diarizationPerMin ?? 0) === 0 ? 'included with Nova-3, no add-on' : `${mmss(layerMs)} at ${rateBoth(r.diarizationPerMin ?? 0)}`, color: COLORS.included }; bundled.push(l); alaCarte.push(l); }
  if (usage.redactMs > 0) { const l: CostLine = { key: 'redact', label: 'Redaction add-on', amount: perMin(usage.redactMs) * r.redactionPerMin, note: `${mmss(usage.redactMs)} at ${rateBoth(r.redactionPerMin)}`, color: COLORS.addon }; bundled.push(l); alaCarte.push(l); }
  if (usage.keytermMs > 0) { const l: CostLine = { key: 'keyterm', label: 'Keyterm prompting add-on', amount: perMin(usage.keytermMs) * r.keytermPerMin, note: `${mmss(usage.keytermMs)} at ${rateBoth(r.keytermPerMin)}`, color: COLORS.addon }; bundled.push(l); alaCarte.push(l); }

  const fluxTts = catalog.speak.find((s) => s.family === 'flux');
  const auraTts = catalog.speak.find((s) => s.family === 'aura');
  const chars = (n: number) => `${n.toLocaleString('en-US')} characters spoken`;
  if (usage.ttsCharsByFamily.flux > 0 && fluxTts) {
    const rate = ttsRate(catalog, fluxTts, end);
    alaCarte.push({ key: 'tts-flux', label: 'Flux TTS', amount: (usage.ttsCharsByFamily.flux / 1000) * rate, regular: fluxTts.regularPer1k != null ? (usage.ttsCharsByFamily.flux / 1000) * fluxTts.regularPer1k : undefined, note: rate === 0 ? `${chars(usage.ttsCharsByFamily.flux)}, free through ${r.promoEnds} (then $${fluxTts.regularPer1k} per 1,000)` : `${chars(usage.ttsCharsByFamily.flux)} at $${rate} per 1,000`, color: COLORS.tts });
  }
  if (usage.ttsCharsByFamily.aura > 0 && auraTts) alaCarte.push({ key: 'tts-aura', label: 'Aura-2 TTS', amount: (usage.ttsCharsByFamily.aura / 1000) * auraTts.ratePer1k, note: `${chars(usage.ttsCharsByFamily.aura)} at $${auraTts.ratePer1k} per 1,000`, color: COLORS.tts });

  const sum = (xs: CostLine[]) => xs.reduce((a, b) => a + b.amount, 0);
  const talkMs = agentMs > 0 ? agentMs : layerMs;
  const bundledTotal = sum(bundled);
  return { bundled, alaCarte, bundledTotal, alaCarteTotal: sum(alaCarte), minutes: perMin(talkMs), talkMs, hourly: talkMs >= 1000 ? bundledTotal / (talkMs / 3600000) : null, promo, duet };
}

export interface PanelCost {
  /** À la carte dollars for this one panel. */
  amount: number;
  /** What was metered: seconds heard for a person, characters spoken for the robot. */
  units: string;
  free?: boolean;
}
/** À la carte cost of a single panel: seconds of STT for the visitor, TTS characters for the robot. */
export function panelCost(p: Panel, catalog: Catalog, now = Date.now()): PanelCost | null {
  if (p.role === 'user') {
    const m = catalog.listen.find((l) => l.model === p.model && l.version === p.version) ?? catalog.listen.find((l) => l.model === p.model);
    const end = p.endedAt ?? p.startedAt;
    if (!m || end <= p.startedAt) return null;
    const ms = end - p.startedAt;
    return { amount: perMin(ms) * m.ratePerMin, units: `${Math.max(1, Math.round(ms / 1000))} s heard` };
  }
  const s = catalog.speak.find((v) => v.model === p.model);
  if (!s || !p.text) return null;
  const rate = ttsRate(catalog, s, now);
  return { amount: (p.text.length / 1000) * rate, units: `${p.text.length} chars`, free: rate === 0 };
}
/** The tag on a panel. One panel costs a fraction of a cent, so the tag prices a thousand of them. */
export const panelTag = (c: PanelCost) => (c.free ? `${c.units} · free now` : `${c.units} · 1k of these: ${price(c.amount * 1000)}`);
