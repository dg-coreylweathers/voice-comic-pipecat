/**
 * Screenshot one route of the built app:
 *   node scripts/shot.mjs /cast out.png [width] [height]
 *   node scripts/shot.mjs test/fixtures/strip.json out.png   # saves the fixture strip first, screenshots its replay
 * VC_BASE=https://... targets a deployment for a route (fixtures are always saved to a local throwaway server).
 */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { openPage, startApp } from './lib.mjs';

const [route = '/', out = 'shot.png', w = '1400', h = '900'] = process.argv.slice(2);
const { base, server } = await startApp(8091, { stderr: 'inherit', allowRemote: !route.endsWith('.json') }); // never post fixtures to a deployment
let browser;
try {
  browser = await chromium.launch();
  let target = route;
  if (route.endsWith('.json')) {
    const r = await fetch(`${base}/api/strips`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: fs.readFileSync(route) });
    if (!r.ok) throw new Error(`fixture save failed: ${r.status} ${await r.text()}`);
    target = (await r.json()).url;
  }
  const { page, errors, shot } = await openPage(browser, { width: Number(w), height: Number(h) });
  const res = await page.goto(base + target);
  if (!res?.ok()) throw new Error(`${target} returned ${res?.status()} (did you run make build?)`);
  await page.locator('.strip, .how, .hero').first().waitFor({ timeout: 15000 });
  await shot(out);
  if (errors.length) console.error('page errors:', errors.join(' | '));
  console.log('wrote', out);
} finally {
  await browser?.close(); server?.kill('SIGTERM');
}
