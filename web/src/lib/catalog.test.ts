import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_FILE, PLACEHOLDER, localCatalog, priceOf } from './catalog.ts';

test('the bundled catalog is the shared file', () => {
  assert.equal(CATALOG_FILE.schemaVersion, 1);
  assert.ok(CATALOG_FILE.listen.some((m) => m.key === CATALOG_FILE.defaults.listen && m.role === 'primary'));
  assert.ok(CATALOG_FILE.think.every((t) => t.provider === 'anthropic' && t.llm));
});

test('placeholder prices are unknown, never zero', () => {
  assert.equal(priceOf(PLACEHOLDER), null);
  assert.equal(priceOf(0), 0);
});

test('localCatalog adds deployment facts like GET /api/catalog', () => {
  const c = localCatalog('booth', { enabled: true, transcriptTtlHours: 2 });
  assert.equal(c.event, 'booth');
  assert.equal(c.booth.enabled, true);
  assert.ok(c.flux && c.flux.eagerEotThreshold.default < c.flux.eotThreshold.default);
});
