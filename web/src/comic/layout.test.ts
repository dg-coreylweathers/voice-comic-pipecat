import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrap, fitText } from './layout.ts';

test('wrap keeps character offsets', () => {
  const lines = wrap('hello brave new world', 11);
  assert.deepEqual(lines.map((l) => l.text), ['hello brave', 'new world']);
  assert.deepEqual(lines.map((l) => l.start), [0, 12]);
});
test('wrap hard-splits very long words', () => {
  assert.deepEqual(wrap('supercalifragilistic', 5).map((l) => l.text), ['super', 'calif', 'ragil', 'istic']);
});
test('fitText shrinks font until it fits', () => {
  const short = fitText('hi there', 300, 6);
  assert.equal(short.fontSize, 20);
  const long = fitText('word '.repeat(80), 300, 6);
  assert.ok(long.fontSize < 20 && long.lines.length <= 6);
});
