/**
 * The vc.* app protocol on top of RTVI 2.3.0. Mirror of shared/protocol.schema.json (the contract) and of
 * server/vc/protocol.py. protocol.test.ts checks FIELDS against the schema and the shared examples; tsc checks
 * that FIELDS only names keys these types have. Change all three together and bump PROTOCOL_VERSION on a break.
 *
 * Standard RTVI traffic (user-input with perception / input_type backchannel, bot-output, speaking events,
 * bot-interrupted, metrics) is NOT redefined here: use the @pipecat-ai/client-js callbacks.
 */

export const PROTOCOL_VERSION = 1;

export type ExperienceKey = 'agent' | 'duet';

export interface Word { word: string; start: number; end: number; confidence?: number; speaker?: number }
export interface FluxDialValues { eotThreshold?: number; eagerEotThreshold?: number }

/** Everything needed to build the pipeline; base64url JSON in the `cfg` query param of WS /api/agent. */
export interface SessionConfig {
  experience: ExperienceKey;
  listenKey: string;
  speakKey: string;
  thinkKey: string;
  modeKey: string;
  keyterms: string[];
  redact: boolean;
  speakers: boolean;
  quiet: boolean;
  flux?: FluxDialValues;
}

export interface PipelineStage { name: string; cls: string; branch: 'main' | 'nova' | 'switcher' | 'observer'; model?: string; active?: boolean; settings?: Record<string, unknown> }
export interface ConfigChange { field: string; frame: string; live: boolean }
export interface TokenUsage { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; calls: number; withdrawnCalls: number }
export interface UsageReport {
  experience: ExperienceKey;
  connectedAt: number;
  disconnectedAt?: number;
  connectedMs: number;
  connectedMsByTier: { standard?: number; advanced?: number };
  sttSecondsByKey: Record<string, number>;
  redactSeconds: number;
  keytermSeconds: number;
  ttsCharsByKey: Record<string, number>;
  ttsCharsByFamily: { flux: number; aura: number };
  llmByKey: Record<string, TokenUsage>;
  server: true;
}
export type PanelMood = 'neutral' | 'happy' | 'smug' | 'laughing' | 'surprised' | 'thinking' | 'upset';
export type PanelSfx = 'POW' | 'BOING' | 'HA HA' | 'WOW!' | 'ZAP' | 'HMM' | 'DING';
export const PANEL_MOODS: readonly PanelMood[] = ['neutral', 'happy', 'smug', 'laughing', 'surprised', 'thinking', 'upset'];
export const PANEL_SFX: readonly PanelSfx[] = ['POW', 'BOING', 'HA HA', 'WOW!', 'ZAP', 'HMM', 'DING'];
export interface LatencyPart { key: string; label: string; owner: string; ms: number }

// ---- server -> client (data of an RTVI server-message) ------------------------------------------------------

export interface VcSession { type: 'vc.session'; id: string; protocolVersion: 1; experience: ExperienceKey; config: SessionConfig; pipeline: PipelineStage[] }
export interface VcConfig { type: 'vc.config'; config: SessionConfig; changes: ConfigChange[]; pipeline: PipelineStage[] }
export interface VcTurn {
  type: 'vc.turn'; panelId: string; epoch: number; turnIndex: number;
  event: 'StartOfTurn' | 'Update' | 'EagerEndOfTurn' | 'TurnResumed' | 'EndOfTurn';
  transcript: string; words: Word[]; endOfTurnConfidence?: number; languages?: string[]; model: string;
}
export interface VcEager { type: 'vc.eager'; panelId: string; phase: 'predicted' | 'withdrawn' | 'released'; transcript?: string; reason?: 'turn_resumed' | 'cancelled' | 'timeout'; heldMs?: number }
export interface VcLayer { type: 'vc.layer'; panelId: string; key: string; model: string; isFinal: boolean; speechFinal?: boolean; transcript: string; words: Word[]; speaker?: number; redacted: boolean }
export interface VcLayerStatus { type: 'vc.layer.status'; state: 'open' | 'closed' | 'error'; key?: string; model?: string; redact?: string[]; diarize?: boolean; message?: string }
export interface VcIntel { type: 'vc.intel'; panelId: string; topics: string[]; intents: string[]; sentiment?: 'positive' | 'neutral' | 'negative'; score?: number }
export interface VcPanel { type: 'vc.panel'; assistantTurn: number; at: number; mood: PanelMood; sfx?: PanelSfx; caption?: string }
export interface VcLatency { type: 'vc.latency'; assistantTurn: number; ms: number; from: 'flux_end_of_turn' | 'typed_line'; eager?: boolean }
export interface VcLatencyBreakdown { type: 'vc.latency.breakdown'; assistantTurn: number; totalMs: number; userTurnMs?: number; parts: LatencyPart[] }
export interface VcUsage { type: 'vc.usage'; usage: UsageReport }
export interface VcError { type: 'vc.error'; message: string; source?: string; fatal?: boolean }

export type ServerMessage = VcSession | VcConfig | VcTurn | VcEager | VcLayer | VcLayerStatus | VcIntel | VcPanel | VcLatency | VcLatencyBreakdown | VcUsage | VcError;

// ---- client -> server (an RTVI client-message: our `type` is its type, the rest its data) ---------------------

export interface VcUpdate { type: 'vc.update'; listenKey?: string; speakKey?: string; thinkKey?: string; modeKey?: string; keyterms?: string[]; redact?: boolean; speakers?: boolean; flux?: FluxDialValues }
export interface VcSay { type: 'vc.say'; id: string; text: string }
export interface VcReset { type: 'vc.reset'; quiet?: boolean }
export type ClientMessage = VcUpdate | VcSay | VcReset;

// ---- field lists, checked against the schema in protocol.test.ts ---------------------------------------------

type Fields<T> = readonly (keyof T & string)[];
/** Every object $def in the schema, with its wire fields. tsc rejects a field the type lacks; the test rejects a missing one. */
export const FIELDS = {
  Word: ['word', 'start', 'end', 'confidence', 'speaker'] satisfies Fields<Word>,
  FluxDialValues: ['eotThreshold', 'eagerEotThreshold'] satisfies Fields<FluxDialValues>,
  SessionConfig: ['experience', 'listenKey', 'speakKey', 'thinkKey', 'modeKey', 'keyterms', 'redact', 'speakers', 'quiet', 'flux'] satisfies Fields<SessionConfig>,
  PipelineStage: ['name', 'cls', 'branch', 'model', 'active', 'settings'] satisfies Fields<PipelineStage>,
  ConfigChange: ['field', 'frame', 'live'] satisfies Fields<ConfigChange>,
  TokenUsage: ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'calls', 'withdrawnCalls'] satisfies Fields<TokenUsage>,
  UsageReport: ['experience', 'connectedAt', 'disconnectedAt', 'connectedMs', 'connectedMsByTier', 'sttSecondsByKey', 'redactSeconds', 'keytermSeconds', 'ttsCharsByKey', 'ttsCharsByFamily', 'llmByKey', 'server'] satisfies Fields<UsageReport>,
  LatencyPart: ['key', 'label', 'owner', 'ms'] satisfies Fields<LatencyPart>,
  VcSession: ['type', 'id', 'protocolVersion', 'experience', 'config', 'pipeline'] satisfies Fields<VcSession>,
  VcConfig: ['type', 'config', 'changes', 'pipeline'] satisfies Fields<VcConfig>,
  VcTurn: ['type', 'panelId', 'epoch', 'turnIndex', 'event', 'transcript', 'words', 'endOfTurnConfidence', 'languages', 'model'] satisfies Fields<VcTurn>,
  VcEager: ['type', 'panelId', 'phase', 'transcript', 'reason', 'heldMs'] satisfies Fields<VcEager>,
  VcLayer: ['type', 'panelId', 'key', 'model', 'isFinal', 'speechFinal', 'transcript', 'words', 'speaker', 'redacted'] satisfies Fields<VcLayer>,
  VcLayerStatus: ['type', 'state', 'key', 'model', 'redact', 'diarize', 'message'] satisfies Fields<VcLayerStatus>,
  VcIntel: ['type', 'panelId', 'topics', 'intents', 'sentiment', 'score'] satisfies Fields<VcIntel>,
  VcPanel: ['type', 'assistantTurn', 'at', 'mood', 'sfx', 'caption'] satisfies Fields<VcPanel>,
  VcLatency: ['type', 'assistantTurn', 'ms', 'from', 'eager'] satisfies Fields<VcLatency>,
  VcLatencyBreakdown: ['type', 'assistantTurn', 'totalMs', 'userTurnMs', 'parts'] satisfies Fields<VcLatencyBreakdown>,
  VcUsage: ['type', 'usage'] satisfies Fields<VcUsage>,
  VcError: ['type', 'message', 'source', 'fatal'] satisfies Fields<VcError>,
  VcUpdate: ['type', 'listenKey', 'speakKey', 'thinkKey', 'modeKey', 'keyterms', 'redact', 'speakers', 'flux'] satisfies Fields<VcUpdate>,
  VcSay: ['type', 'id', 'text'] satisfies Fields<VcSay>,
  VcReset: ['type', 'quiet'] satisfies Fields<VcReset>,
} as const;

export const SERVER_TYPES: readonly ServerMessage['type'][] = ['vc.session', 'vc.config', 'vc.turn', 'vc.eager', 'vc.layer', 'vc.layer.status', 'vc.intel', 'vc.panel', 'vc.latency', 'vc.latency.breakdown', 'vc.usage', 'vc.error'];
export const CLIENT_TYPES: readonly ClientMessage['type'][] = ['vc.update', 'vc.say', 'vc.reset'];

// ---- helpers ---------------------------------------------------------------------------------------------------

/** Narrow an RTVI server-message `data` to a vc.* message, or null for anything else. Shape is trusted (server-built). */
export function asServerMessage(data: unknown): ServerMessage | null {
  const t = (data as { type?: unknown } | null)?.type;
  return typeof t === 'string' && (SERVER_TYPES as readonly string[]).includes(t) ? (data as ServerMessage) : null;
}

/** Minimal surface of PipecatClient used to send; keeps this module free of the client-js import for node tests. */
export interface ClientMessageSink { sendClientMessage(msgType: string, data?: unknown): void }
export function sendVc(client: ClientMessageSink, msg: ClientMessage) {
  const { type, ...data } = msg;
  client.sendClientMessage(type, data);
}

/** base64url(JSON) for the `cfg` query parameter. */
export function encodeSessionConfig(cfg: SessionConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
