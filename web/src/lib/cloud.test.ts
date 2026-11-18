import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutCloud } from './cloud.ts';

const terms = ['pricing', 'latency', 'languages', 'python sdk', 'self-hosted', 'accuracy', 'voice agents', 'whisper', 'security', 'streaming'].map((term, i) => ({ term, count: 20 - i * 2, sentiment: i % 3 === 0 ? 0.4 : i % 3 === 1 ? -0.4 : 0, firstAt: 0, lastAt: 0 }));

test('cloud is deterministic, in bounds and free of overlaps', () => {
  const a = layoutCloud(terms, 800, 400), b = layoutCloud(terms, 800, 400);
  assert.deepEqual(a, b);
  assert.equal(a.length, terms.length);
  assert.equal(a[0].term, 'pricing');
  assert.ok(a[0].size > a[a.length - 1].size);
  for (const p of a) { assert.ok(p.x - p.w / 2 >= 0 && p.x + p.w / 2 <= 800 && p.y - p.h / 2 >= 0 && p.y + p.h / 2 <= 400, `${p.term} in bounds`); }
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
    const p = a[i], q = a[j];
    const apart = p.x + p.w / 2 <= q.x - q.w / 2 || q.x + q.w / 2 <= p.x - p.w / 2 || p.y + p.h / 2 <= q.y - q.h / 2 || q.y + q.h / 2 <= p.y - p.h / 2;
    assert.ok(apart, `${p.term} overlaps ${q.term}`);
  }
  assert.deepEqual(layoutCloud([], 100, 100), []);
  assert.ok(layoutCloud(terms, 120, 60).length < terms.length, 'a tiny canvas drops the smallest terms instead of overlapping');
});
