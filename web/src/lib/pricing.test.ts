import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentRate, atScale, computeCost, mmss, panelCost, panelTag, perHour, price, promoActive, rateBoth, ttsRate } from './pricing.ts';
import type { Catalog, Usage } from './types.ts';

const catalog = {
  listen: [
    { key: 'flux-en', version: 'v2', model: 'flux-general-en', label: 'Flux STT · English', family: 'flux', ratePerMin: 0.0065, regularPerMin: 0.0077, blurb: '' },
    { key: 'nova-3-en', version: 'v1', model: 'nova-3', language: 'en', label: 'Nova-3 · English', family: 'nova', ratePerMin: 0.0048, regularPerMin: 0.0077, blurb: '' },
  ],
  speak: [
    { key: 'flux-kit', version: 'v2', model: 'flux-kit-en', label: 'Flux TTS · Kit', family: 'flux', ratePer1k: 0, regularPer1k: 0.045 },
    { key: 'aura-2-thalia', version: 'v1', model: 'aura-2-thalia-en', label: 'Aura-2 · Thalia', family: 'aura', ratePer1k: 0.03 },
  ],
  think: [{ key: 'claude-haiku-4-5', provider: 'anthropic', model: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', tier: 'standard' }],
  modes: [], experiences: [], event: 'test',
  rates: { asOf: '2026-09-03', source: '', promoEnds: '2026-09-14', agentPerMinByTier: { standard: { label: 'Standard', promo: 0.056, regular: 0.075 }, advanced: { label: 'Advanced', promo: 0.122, regular: 0.163 } }, redactionPerMin: 0.002, keytermPerMin: 0.0013, diarizationPerMin: 0 },
  defaults: { listen: 'flux-en', speak: 'flux-kit', think: 'claude-haiku-4-5', mode: 'visitor' },
  booth: { enabled: false, transcriptTtlHours: 2 },
} as unknown as Catalog;

const DURING = Date.parse('2026-09-10T12:00:00-07:00');
const AFTER = Date.parse('2026-09-16T12:00:00-07:00');
const MIN = 60000;

test('promo rates apply through the last promo day, regular rates after', () => {
  assert.equal(promoActive(catalog, DURING), true);
  assert.equal(promoActive(catalog, Date.parse('2026-09-14T23:00:00-07:00')), true);
  assert.equal(promoActive(catalog, Date.parse('2026-09-15T00:30:00-07:00')), false);
  assert.equal(promoActive(catalog, AFTER), false);
  assert.equal(agentRate(catalog, 'standard', DURING), 0.056);
  assert.equal(agentRate(catalog, 'standard', AFTER), 0.075);
  assert.equal(agentRate(catalog, 'advanced', AFTER), 0.163);
  assert.equal(ttsRate(catalog, catalog.speak[0], DURING), 0);
  assert.equal(ttsRate(catalog, catalog.speak[0], AFTER), 0.045);
  assert.equal(ttsRate(catalog, catalog.speak[1], AFTER), 0.03, 'Aura-2 has no promo');
});

test('agent experience: bundle follows the LLM tier minutes and the layer model; à la carte follows the selected models', () => {
  const usage: Usage = { experience: 'agent', connectedAt: 0, disconnectedAt: 3 * MIN, listenMsByKey: { 'flux-en': 2 * MIN, 'nova-3-en': 1 * MIN }, agentMsByTier: { standard: 2 * MIN, advanced: 1 * MIN }, ttsCharsByFamily: { flux: 1000, aura: 500 }, redactMs: 1 * MIN, keytermMs: 3 * MIN };
  const c = computeCost(usage, catalog, DURING);
  assert.equal(c.duet, false);
  assert.equal(c.minutes, 3);
  const by = Object.fromEntries(c.bundled.map((l) => [l.key, l.amount]));
  assert.ok(Math.abs(by['agent-standard'] - 2 * 0.056) < 1e-9);
  assert.ok(Math.abs(by['agent-advanced'] - 1 * 0.122) < 1e-9);
  assert.ok(Math.abs(by['stt-flux-en'] - 2 * 0.0065) < 1e-9);
  assert.ok(Math.abs(by['stt-nova-3-en'] - 1 * 0.0048) < 1e-9);
  assert.ok(Math.abs(by.redact - 0.002) < 1e-9);
  assert.ok(Math.abs(by.keyterm - 3 * 0.0013) < 1e-9);
  const a = Object.fromEntries(c.alaCarte.map((l) => [l.key, l.amount]));
  assert.equal(a['tts-flux'], 0, 'Flux TTS free during the promo');
  assert.ok(Math.abs(a['tts-aura'] - 0.5 * 0.03) < 1e-9);
  assert.equal('agent-standard' in a, false, 'no agent line à la carte');
  const stillPromo = computeCost(usage, catalog, AFTER);
  assert.ok(Math.abs(Object.fromEntries(stillPromo.bundled.map((l) => [l.key, l.amount]))['agent-standard'] - 2 * 0.056) < 1e-9, 'a session that ended during the promo replays at promo rates');
  const later = computeCost({ ...usage, connectedAt: AFTER - 3 * MIN, disconnectedAt: AFTER }, catalog, AFTER);
  const lb = Object.fromEntries(later.bundled.map((l) => [l.key, l.amount]));
  assert.ok(Math.abs(lb['agent-standard'] - 2 * 0.075) < 1e-9, 'regular agent rate after the promo');
  assert.ok(Math.abs(Object.fromEntries(later.alaCarte.map((l) => [l.key, l.amount]))['tts-flux'] - 0.045) < 1e-9, 'Flux TTS billed after the promo');
});

test('duet experience: no agent minutes at all, diarization included, minutes are STT minutes', () => {
  const usage: Usage = { experience: 'duet', connectedAt: 0, disconnectedAt: 5 * MIN, listenMsByKey: { 'nova-3-en': 4 * MIN }, agentMsByTier: {}, ttsCharsByFamily: { flux: 0, aura: 0 }, redactMs: 0, keytermMs: 0 };
  const c = computeCost(usage, catalog, DURING);
  assert.equal(c.duet, true);
  assert.equal(c.minutes, 4, 'STT minutes, not connection minutes');
  assert.ok(!c.bundled.some((l) => l.key.startsWith('agent-')), 'connection time is never billed as agent minutes');
  assert.ok(Math.abs(c.bundledTotal - 4 * 0.0048) < 1e-9);
  const diar = c.bundled.find((l) => l.key === 'diarize');
  assert.ok(diar && diar.amount === 0 && /included/.test(diar.note));
  // an older strip with no experience still falls back to connection time on the standard tier
  const legacy = computeCost({ connectedAt: DURING - 2 * MIN, disconnectedAt: DURING, listenMsByKey: {}, ttsCharsByFamily: { flux: 0, aura: 0 }, redactMs: 0, keytermMs: 0 }, catalog, DURING);
  assert.ok(Math.abs(legacy.bundledTotal - 2 * 0.056) < 1e-9);
  // a session that talked to Flux and then switched to a duet keeps its agent minutes on the bill
  const mixed = computeCost({ experience: 'duet', connectedAt: DURING - 6 * MIN, disconnectedAt: DURING, listenMsByKey: { 'flux-en': 3 * MIN, 'nova-3-en': 3 * MIN }, agentMsByTier: { standard: 3 * MIN }, ttsCharsByFamily: { flux: 0, aura: 0 }, redactMs: 0, keytermMs: 0 }, catalog, DURING);
  assert.ok(mixed.bundled.some((l) => l.key === 'agent-standard'), 'agent minutes survive a scene switch');
  assert.equal(mixed.minutes, 3);
  // a duet that then switched to Flux chat never bills its connection time as agent minutes
  const flipped = computeCost({ experience: 'agent', connectedAt: DURING - 6 * MIN, disconnectedAt: DURING, listenMsByKey: { 'nova-3-en': 5 * MIN }, agentMsByTier: {}, ttsCharsByFamily: { flux: 0, aura: 0 }, redactMs: 0, keytermMs: 0 }, catalog, DURING);
  assert.ok(!flipped.bundled.some((l) => l.key.startsWith('agent-')));
});

test('panel cost tags use the drawing model and the rate in force, and price a thousand panels', () => {
  const user = { id: 'u', role: 'user', text: 'hi there', final: true, startedAt: 0, endedAt: 30000, model: 'nova-3', version: 'v1' } as const;
  const uc = panelCost(user, catalog, DURING)!;
  assert.ok(Math.abs(uc.amount - 0.5 * 0.0048) < 1e-9);
  assert.equal(uc.units, '30 s heard');
  assert.equal(panelTag(uc), '30 s heard · 1k of these: $2.40');
  const robot = { id: 'g', role: 'agent', text: 'x'.repeat(1000), final: true, startedAt: 0, model: 'flux-kit-en', version: 'v2' } as const;
  const free = panelCost(robot, catalog, DURING)!;
  assert.equal(free.amount, 0);
  assert.equal(panelTag(free), '1000 chars · free now');
  const paid = panelCost(robot, catalog, AFTER)!;
  assert.ok(Math.abs(paid.amount - 0.045) < 1e-9);
  assert.equal(panelTag(paid), '1000 chars · 1k of these: $45.00');
  const short = { ...user, endedAt: 4000 };
  assert.equal(panelTag(panelCost(short, catalog, DURING)!), '4 s heard · 1k of these: 32¢');
});

test('money and time read in units a person can picture: whole cents, m:ss, per hour, per thousand', () => {
  assert.equal(price(0), '0¢');
  assert.equal(price(0.0032), '<1¢');
  assert.equal(price(0.0047), '<1¢');
  assert.equal(price(0.005), '1¢');
  assert.equal(price(0.084), '8¢');
  assert.equal(price(0.994), '99¢');
  assert.equal(price(0.995), '$1.00', 'the 99.5¢ boundary rounds up into dollars');
  assert.equal(price(0.996), '$1.00');
  assert.equal(price(1.2345), '$1.23');
  assert.equal(mmss(0), '0:00');
  assert.equal(mmss(41600), '0:42');
  assert.equal(mmss(92000), '1:32');
  assert.equal(mmss(725000), '12:05');
  assert.equal(perHour(0.056), '$3.36/hr');
  assert.equal(perHour(0.075), '$4.50/hr');
  assert.equal(perHour(0.0048), '$0.29/hr');
  assert.equal(rateBoth(0.0065), '$0.0065/min ($0.39/hr)');
  assert.equal(atScale(0.084), '$84');
  assert.equal(atScale(0.0032), '$3.20');
  assert.equal(atScale(0.00032), '32¢');
  assert.equal(atScale(1.234), '$1,234');
});

test('the breakdown carries talk time and an hourly figure, and no line note shows a fraction of a minute', () => {
  const usage: Usage = { experience: 'agent', connectedAt: 0, disconnectedAt: 92000, listenMsByKey: { 'flux-en': 92000 }, agentMsByTier: { standard: 92000 }, ttsCharsByFamily: { flux: 240, aura: 0 }, redactMs: 0, keytermMs: 0 };
  const c = computeCost(usage, catalog, DURING);
  assert.equal(c.talkMs, 92000);
  assert.ok(Math.abs(c.hourly! - c.bundledTotal / (92 / 3600)) < 1e-9);
  assert.ok(c.bundled.every((l) => /\b\d+:\d\d\b/.test(l.note) || /included/.test(l.note)), 'every timed line reads m:ss');
  assert.ok(c.bundled.every((l) => !/\d\.\d+ min/.test(l.note)), 'no fractional minutes in the notes');
  assert.ok(/\$3\.36\/hr/.test(c.bundled.find((l) => l.key === 'agent-standard')!.note), 'the agent line carries its hourly rate');
  assert.ok(/240 characters spoken, free through 2026-09-14/.test(c.alaCarte.find((l) => l.key === 'tts-flux')!.note));
  const empty = computeCost({ experience: 'agent', listenMsByKey: {}, agentMsByTier: {}, ttsCharsByFamily: { flux: 0, aura: 0 }, redactMs: 0, keytermMs: 0 }, catalog, DURING);
  assert.equal(empty.hourly, null, 'nothing metered, nothing to extrapolate');
  assert.equal(empty.talkMs, 0);
});
