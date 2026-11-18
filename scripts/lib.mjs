/**
 * Shared bootstrap for the test/screenshot scripts: spawn the Python server (unless a base URL is given) and wait for /health.
 *   VC_BASE=https://...      a deployment (only honoured with allowRemote; fixtures are never posted there)
 *   VC_LOCAL_BASE=http://... a throwaway local server that is already running, e.g. the docker-browser container; safe for fixtures
 *   VC_SERVER_CMD="..."      override how the server is spawned (default: uv run --project server python -m vc)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** A page with the standard viewport that collects page errors and can take settled screenshots (fonts loaded, SFX pop finished). */
export async function openPage(browser, { width = 1600, height = 1000, shotsDir } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (name) => {
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: shotsDir ? `${shotsDir}/${name}.png` : name });
  };
  return { page, errors, shot };
}

/**
 * `allowRemote`: honour VC_BASE=https://... and run against that deployment instead of a local server.
 * Scripts that write test data must leave it off so a stray VC_BASE never touches production.
 */
export async function startApp(port, { stderr = 'pipe', env = {}, allowRemote = false } = {}) {
  const remote = (allowRemote ? process.env.VC_BASE : undefined)?.replace(/\/$/, '') || process.env.VC_LOCAL_BASE?.replace(/\/$/, '');
  const base = remote || `http://localhost:${port}`;
  const [cmd, ...args] = (process.env.VC_SERVER_CMD || 'uv run --no-sync --project server python -m vc').split(' ');
  const server = remote ? null : spawn(cmd, args, { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: fs.mkdtempSync(`/tmp/vc-${port}-`), ...env }, stdio: ['ignore', 'ignore', stderr] });
  if (stderr === 'pipe') server?.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
  for (let i = 0; i < 300; i++) { try { if ((await fetch(`${base}/health`)).ok) return { base, server }; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 100)); }
  server?.kill('SIGTERM');
  throw new Error(`server did not answer /health at ${base}`);
}
