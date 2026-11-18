/**
 * Drives the built app in headless Chromium with a fake microphone that plays a
 * real speech WAV, against real Deepgram services.
 *   make build && node scripts/browser.mjs [wav] [screenshotDir]     (or: make docker-browser)
 *
 * COPIED FROM THE VOICE AGENT VERSION, NOT YET PORTED (lane T). Checks that name Voice Agent events
 * (SettingsApplied, vc.listen.status, UpdateListen...) must move to the Pipecat equivalents listed in
 * docs/LANES.md (lane T): vc.session, vc.config, vc.turn, vc.layer.status, RTVI bot-output, ghost bubble, etc.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, openPage, startApp } from './lib.mjs';

const WAV = path.resolve(process.argv[2] || path.join(ROOT, 'test', 'fixtures', 'booth16k.wav'));
const SHOTS = path.resolve(process.argv[3] || path.join(ROOT, 'test', 'shots'));
fs.mkdirSync(SHOTS, { recursive: true });
const fails = [];
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'} ${l}`); if (!c) fails.push(l); };

// VC_BASE=https://dg-voice-comic.fly.dev runs the same checks against a deployed instance instead of spawning a server.
const { base, server } = await startApp(8090, { allowRemote: true, env: { BOOTH_MODE: '' } }).catch((e) => { console.log(`FAIL ${e.message}`); process.exit(1); });
console.log(`target: ${base}`);

const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${WAV}`, '--autoplay-policy=no-user-gesture-required'] });
const { page, errors: pageErrors, shot } = await openPage(browser, { shotsDir: SHOTS });
const xrayHas = async (needle, ms = 8000) => page.waitForFunction((n) => [...document.querySelectorAll('.xray .ev')].some((e) => e.textContent.includes(n)), needle, { timeout: ms }).then(() => true).catch(() => false);

try {
  await page.goto(base);
  check(await page.getByText('Watch it get drawn.').waitFor({ timeout: 15000 }).then(() => true).catch(() => false), 'hero renders');
  check((await page.locator('.attract .panel').count()) === 2, 'attract loop draws a two-panel beat on the idle screen');
  await shot('01-hero');
  await page.getByLabel('Mode', { exact: true }).selectOption({ label: 'Showcase' });
  await page.getByRole('button', { name: /Talk to Flux/ }).first().click();
  check(await page.getByText('Before we draw you').isVisible(), 'consent gate shown before mic');
  await page.getByRole('button', { name: /I'm in/ }).click();
  await page.getByRole('button', { name: /Stop/ }).waitFor({ timeout: 15000 });
  check(true, 'session live (Settings applied)');
  await page.keyboard.press('x');
  await page.locator('.xray').waitFor({ timeout: 3000 });
  check(await xrayHas('SettingsApplied'), 'X-ray shows SettingsApplied');
  check(await xrayHas('vc.listen.status'), 'transcript layer status logged');
  await page.locator('.panel--user').first().waitFor({ timeout: 25000 });
  check(true, 'user panel appeared from Flux TurnInfo');
  await page.waitForFunction(() => document.querySelector('.panel--user .bubble text')?.textContent.trim().length > 5, null, { timeout: 15000 });
  check(true, 'bubble fills with transcript text');
  check(await page.waitForFunction(() => [...document.querySelectorAll('.panel--user .label text')].some((t) => /listening|heard you/.test(t.textContent)), null, { timeout: 8000 }).then(() => true).catch(() => false), 'plain-language micro-label on the visitor panel');
  await shot('02-first-panel');
  await page.locator('.panel--agent').first().waitFor({ timeout: 30000 });
  check(true, 'agent panel appeared (ConversationText assistant)');
  check((await page.locator('.panel--user .char--user .arms').count()) >= 1 && (await page.locator('.panel--agent .char--agent .crest').count()) >= 1, 'cast drawn: visitor with arms, Flux with waveform crest');
  check(await page.evaluate(() => [...document.querySelectorAll('.panel--user .char--user text')].some((t) => t.textContent === 'STAFF')), 'showcase mode badges the speaker as STAFF');
  check((await page.locator('.status--live').count()) === 1, 'status pill reads LIVE');
  await page.getByRole('button', { name: /Pause/ }).click();
  check(await page.locator('.status--paused').waitFor({ timeout: 3000 }).then(() => true).catch(() => false), 'pause: status pill reads PAUSED, mic muted');
  check(await xrayHas('vc.paused', 3000), 'proxy acknowledged the pause (silence pump)');
  await page.getByRole('button', { name: /Resume/ }).click();
  check(await page.locator('.status--live').waitFor({ timeout: 3000 }).then(() => true).catch(() => false), 'resume: status pill back to LIVE');
  await page.getByRole('button', { name: /New chat/ }).click();
  check(await xrayHas('new conversation', 5000), 'reset: fresh agent session requested');
  check(await page.locator('.divider').waitFor({ timeout: 40000 }).then(() => true).catch(() => false), 'NEW CONVERSATION divider drawn before the next panel');
  await page.waitForFunction(() => document.querySelectorAll('.panel').length >= 3, null, { timeout: 40000 }).catch(() => {});
  const panelCount = await page.locator('.panel').count();
  check(panelCount >= 2, `strip has ${panelCount} panels`);
  check(await xrayHas('TurnInfo/EndOfTurn', 35000), 'X-ray shows Flux EndOfTurn');
  check(await xrayHas('vc.intel', 15000), 'Text Intelligence result logged');
  check(await xrayHas('LatencyReport', 25000), 'LatencyReport logged');
  const cost = await page.locator('.toolbar .chip').first().textContent();
  check(/(\$\d|\d¢|<1¢)/.test(cost), `cost chip shows ${cost.trim()}`);
  await shot('03-strip-xray');
  await page.locator('.toolbar .chip').first().click();
  check(await page.getByText('Where the money goes').waitFor({ timeout: 5000 }).then(() => true).catch(() => false), 'cost breakdown opens');
  check((await page.locator('.cost .bar svg rect').count()) >= 3, 'cost bars rendered');
  await shot('03b-cost');
  await page.getByRole('button', { name: 'Close' }).click();

  // Teach keyterms mid-session
  await page.getByPlaceholder('Deepgram, Fly.io, your startup').fill('Deepgram, Fly.io, Voice Comic');
  await page.getByRole('button', { name: 'Teach' }).click();
  check(await xrayHas('vc.update'), 'keyterms re-taught (vc.update -> UpdateListen + layer reopen)');

  // Redaction: layer switches to Nova-3
  await page.keyboard.press('r');
  await page.waitForFunction(() => document.querySelector('.xray .layer')?.textContent.includes('nova-3'), null, { timeout: 10000 });
  check(true, 'Redact on → transcript layer running Nova-3');
  const redactedSeen = await page.waitForFunction(() => [...document.querySelectorAll('.panel--user .bubble text')].some((t) => t.textContent.includes('█')), null, { timeout: 45000 }).then(() => true).catch(() => false);
  check(redactedSeen, 'censor bars drawn in a bubble');
  check(await page.evaluate(() => [...document.querySelectorAll('.panel--user .label text')].some((t) => /redacted|switched to Nova-3/.test(t.textContent))), 'micro-label explains the redaction / model switch');
  await shot('04-redacted');

  // Switch agent voice and listen model mid-session
  await page.getByLabel('LLM model').selectOption({ label: 'Claude Sonnet 4.5 · Advanced' });
  check(await xrayHas('ThinkUpdated', 8000), 'UpdateThink acknowledged (Claude Haiku 4.5 → Sonnet 4.5)');
  await page.getByLabel('Voice model').selectOption({ label: 'Aura-2 · Thalia' });
  check(await xrayHas('SpeakUpdated', 8000), 'UpdateSpeak acknowledged (Flux TTS → Aura-2)');
  await page.getByLabel('Listen model').selectOption({ label: 'Nova-3 · English' });
  const listenOk = (await xrayHas('ListenUpdated', 6000)) || (await xrayHas('reconnect', 6000));
  check(listenOk, 'UpdateListen acknowledged or reconnect fallback used (Flux → Nova-3)');
  await page.waitForTimeout(6000);
  const interrupted = await page.evaluate(() => [...document.querySelectorAll('.panel--agent tspan')].some((t) => t.getAttribute('text-decoration') === 'line-through'));
  console.log(`info barge-in strikethrough observed: ${interrupted}`);
  await shot('05-switched');

  // Save & share → replay
  await page.getByRole('button', { name: 'Save & share' }).click();
  await page.getByText('Your strip is saved').waitFor({ timeout: 20000 });
  const link = await page.locator('.share input').inputValue();
  check(/\/s\/[A-Za-z0-9]{10}$/.test(link), `share link ${link}`);
  const savedStrip = await (await fetch(link.replace(/\/s\//, '/api/strips/'))).json();
  check(savedStrip.usage?.server === true && savedStrip.usage.connectedAt > 0 && (savedStrip.usage.disconnectedAt - savedStrip.usage.connectedAt) > 30000, `saved usage is server-metered: ${JSON.stringify({ ...savedStrip.usage, listenMsByKey: savedStrip.usage?.listenMsByKey })}`);
  check((await page.locator('.share canvas').count()) === 1, 'QR code rendered');
  await shot('06-share');
  await page.goto(link);
  await page.locator('.strip .panel').first().waitFor({ timeout: 10000 });
  const replayPanels = await page.locator('.strip .panel').count();
  check(replayPanels >= 2, `replay shows ${replayPanels} panels`);
  check((await page.locator('audio').count()) === 1, 'replay has recorded audio');
  await page.getByRole('button', { name: /Replay/ }).click();
  await page.waitForTimeout(2500);
  await shot('07-replay');
  await page.goto(`${base}/how`);
  check(await page.getByText('How Voice Comic works').waitFor({ timeout: 15000 }).then(() => true).catch(() => false), '/how page renders');
  check((await page.locator('.beat').count()) === 3, '/how leads with the three-beat pitch');
  await page.getByRole('button', { name: 'Show me the wire' }).click();
  check((await page.locator('svg[role=img]').count()) >= 2, 'diagrams rendered behind "show me the wire"');
  await shot('08-how');
  await page.goto(`${base}/cast`);
  await page.locator('.cast').waitFor({ timeout: 15000 });
  check((await page.locator('.cast .char').count()) === 12, 'cast sheet shows 2 characters x 6 expressions');
  await shot('09-cast');
  await page.goto(`${base}/themes`);
  await page.locator('.cloud').waitFor({ timeout: 15000 });
  check(await page.locator('.cloud-word').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false), 'themes page draws a word cloud from this session\'s turns');
  await shot('11-themes');
  // Booth mode: hotkey b turns redaction on, the consent screen says what is and is not stored, and w wipes the strip.
  await page.goto(base);
  await page.getByText('Watch it get drawn.').waitFor({ timeout: 15000 });
  await page.keyboard.press('b');
  check((await page.getByLabel('Booth').isChecked()) && (await page.getByLabel('Redact').isChecked()), 'b turns on booth mode and redaction');
  await page.getByRole('button', { name: /Start talking/ }).first().click();
  check(await page.getByText('Booth mode is on.').isVisible(), 'consent screen explains booth mode honestly');
  await page.getByRole('button', { name: /I'm in/ }).click();
  await page.locator('.panel--user').first().waitFor({ timeout: 30000 });
  await shot('10-booth');
  await page.keyboard.press('w');
  // The idle screen's attract loop draws its own panels, so look for the live strip wrapper, not .panel.
  check((await page.locator('.strip-wrap').count()) === 0 && (await page.getByText('Strip wiped').isVisible()) && (await page.getByText('Watch it get drawn.').isVisible()), 'w wipes the strip instantly and returns to the idle screen');

  // Two people talking: no agent, Nova-3 diarization, panels split by speaker, cost meter without an agent line. Fresh load so the consent gate shows again.
  await page.goto(base);
  await page.getByText('Watch it get drawn.').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Two people talking/ }).click();
  check(await page.getByText('No AI agent listens or replies').isVisible(), 'duet consent copy says there is no agent');
  await page.getByRole('button', { name: /I'm in/ }).click();
  await page.getByRole('button', { name: /Stop/ }).waitFor({ timeout: 15000 });
  check((await page.getByLabel('Scene').inputValue()) === 'duet', 'scene select reads Two people');
  check((await page.getByLabel('Listen model').inputValue()) === 'nova-3-en' && (await page.getByLabel('Voice model').count()) === 0 && (await page.getByLabel('LLM model').count()) === 0, 'duet toolbar: Listen pinned to Nova-3, no Voice or Brain rack');
  await page.keyboard.press('x');
  check(await page.waitForFunction(() => document.querySelector('.xray .layer')?.textContent.includes('diarize=true'), null, { timeout: 15000 }).then(() => true).catch(() => false), 'transcript layer URL carries diarize=true');
  await page.locator('.panel--user').first().waitFor({ timeout: 30000 });
  check(await page.waitForFunction(() => [...document.querySelectorAll('.panel--user .char--user text')].some((t) => /^SPEAKER \d/.test(t.textContent)), null, { timeout: 15000 }).then(() => true).catch(() => false), 'duet panels badge the speaker as SPEAKER n');
  check((await page.locator('.panel--agent').count()) === 0, 'no robot panels in a duet');
  check(!(await xrayHas('SettingsApplied', 1500)), 'duet: no SettingsApplied in the X-ray, so no agent socket was opened');
  check(await page.locator('.toolbar .chip.voices').textContent().then((t) => /diarization/.test(t)), 'duet chip reports diarization status');
  const duetCost = await page.locator('.toolbar .chip').filter({ hasText: /\$|¢/ }).first().textContent();
  check(/(\$\d|\d¢|<1¢)/.test(duetCost), `duet cost chip shows ${duetCost.trim()}`);
  await page.locator('.toolbar .chip').filter({ hasText: /\$|¢/ }).first().click();
  await page.getByText('Where the money goes').waitFor({ timeout: 5000 });
  const modalText = await page.locator('.modal.cost').textContent();
  check(/No agent in this scene/.test(modalText) && !/Voice Agent API · Standard tier/.test(modalText) && /diarization/i.test(modalText), 'duet cost modal: Nova-3 minutes only, diarization included, no Voice Agent line');
  await shot('12-duet-cost');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(8000);
  const duetPanels = await page.locator('.panel--user').count();
  console.log(`info duet drew ${duetPanels} panel(s) from the single-voice fake mic (two voices are covered by scripts/live.mjs)`);
  await shot('13-duet-strip');
  await page.getByRole('button', { name: /Stop/ }).click();
  check(pageErrors.length === 0, `no page errors${pageErrors.length ? ': ' + pageErrors.slice(0, 3).join(' | ') : ''}`);
} catch (e) {
  fails.push(e.message); console.error('browser test crashed:', e); await shot('99-crash').catch(() => {});
} finally {
  await browser.close(); server?.kill('SIGTERM');
  console.log(fails.length ? `\n${fails.length} FAILURE(S)` : '\nALL BROWSER CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
}
