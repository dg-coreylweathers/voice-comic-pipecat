import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPRESSIONS, FACES, arms } from './cast.ts';

test('every expression is drawn differently', () => {
  assert.deepEqual([...EXPRESSIONS].sort(), ['happy', 'neutral', 'surprised', 'talking', 'thinking', 'upset']);
  const seen = new Set<string>();
  for (const e of EXPRESSIONS) {
    const f = FACES[e];
    const sig = [f.eyes, f.browL, f.mouth, f.pose, f.extra, f.crest.join()].join('|');
    assert.ok(!seen.has(sig), `${e} duplicates another expression`);
    seen.add(sig);
    assert.ok(f.crest.every((h) => h > 0));
  }
});

test('every pose has two arms that end in a hand', () => {
  for (const e of EXPRESSIONS) {
    const a = arms(FACES[e].pose);
    assert.equal(a.length, 2, e);
    for (const arm of a) { assert.match(arm.path, /^M-?40,0 L/); assert.equal(arm.hand.length, 2); }
  }
});
