import { test } from 'node:test';
import assert from 'node:assert/strict';
import schema from '../../../shared/protocol.schema.json' with { type: 'json' };
import examples from '../../../shared/protocol.examples.json' with { type: 'json' };
import { CLIENT_TYPES, FIELDS, PROTOCOL_VERSION, SERVER_TYPES, asServerMessage, encodeSessionConfig, sendVc, type ClientMessage } from './protocol.ts';

type Def = { type?: string; properties?: Record<string, { const?: unknown }>; required?: string[] };
const defs = (schema as unknown as { $defs: Record<string, Def> }).$defs;
const objectDefs = Object.entries(defs).filter(([, d]) => d.type === 'object');

test('protocol version matches the schema', () => {
  assert.equal((schema as { protocolVersion: number }).protocolVersion, PROTOCOL_VERSION);
});

test('every object $def has the same field list in protocol.ts', () => {
  assert.deepEqual(new Set(Object.keys(FIELDS)), new Set(objectDefs.map(([n]) => n)));
  for (const [name, d] of objectDefs) assert.deepEqual(new Set(FIELDS[name as keyof typeof FIELDS]), new Set(Object.keys(d.properties ?? {})), `${name} fields differ`);
});

test('message type lists match the schema consts', () => {
  const consts = (ref: string) => ((defs[ref] as unknown as { oneOf: { $ref: string }[] }).oneOf).map((r) => defs[r.$ref.split('/').pop()!].properties!.type.const as string);
  assert.deepEqual(new Set(SERVER_TYPES), new Set(consts('ServerMessage')));
  assert.deepEqual(new Set(CLIENT_TYPES), new Set(consts('ClientMessage')));
});

test('shared examples only use known fields and carry every required one', () => {
  const byType = new Map(objectDefs.filter(([, d]) => d.properties?.type?.const).map(([n, d]) => [d.properties!.type.const as string, [n, d] as const]));
  for (const ex of [...examples.server, ...examples.client] as Record<string, unknown>[]) {
    const [name, d] = byType.get(ex.type as string)!;
    for (const k of Object.keys(ex)) assert.ok((FIELDS[name as keyof typeof FIELDS] as readonly string[]).includes(k), `${name}.${k} unknown`);
    for (const k of d.required ?? []) assert.ok(k in ex, `${name} example lacks required ${k}`);
  }
  for (const ex of examples.server) assert.ok(asServerMessage(ex), `${ex.type} not recognised`);
  assert.equal(asServerMessage({ type: 'Settings' }), null);
});

test('sendVc splits type from data the way RTVI client-message expects', () => {
  const sent: [string, unknown][] = [];
  sendVc({ sendClientMessage: (t, d) => sent.push([t, d]) }, examples.client[0] as ClientMessage);
  assert.equal(sent[0][0], 'vc.update');
  assert.ok(!('type' in (sent[0][1] as object)));
});

test('session config encodes as unpadded base64url JSON', () => {
  const q = encodeSessionConfig(examples.sessionConfig as Parameters<typeof encodeSessionConfig>[0]);
  assert.match(q, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(JSON.parse(Buffer.from(q, 'base64url').toString()), examples.sessionConfig);
});
