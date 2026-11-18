import { emptyUsage, store, toast } from './store';
import type { Catalog, Settings } from './types';

/**
 * The browser's session layer: owns the PipecatClient, the mic, playback and recording, and maps RTVI + vc.*
 * messages onto comic panels. One instance per strip. Lane C1 implements it; docs/ARCH.md section 5 has the
 * full mapping and docs/LANES.md C1 the acceptance criteria.
 *
 * What replaces what (from the Voice Agent version of this file):
 *  - WebSocket + audio.ts worklet/player  -> new PipecatClient({ transport: new WebSocketTransport({
 *      serializer: new ProtobufFrameSerializer(), recorderSampleRate: 16000, playerSampleRate: 24000 }),
 *      enableMic: true, enableCam: false, callbacks })
 *  - GET /api/session token                -> client.connect({ wsUrl: `/api/agent?cfg=<base64url SessionConfig>`, token })
 *  - vc.settings                           -> the `cfg` query param (SessionConfig in protocol.ts)
 *  - vc.update / vc.say                    -> client.sendClientMessage(type, data) via sendVc() in protocol.ts
 *  - New conversation reconnect            -> sendVc({ type: 'vc.reset' }); no reconnect, no meter resume
 *  - vc.pause + KeepAlive pump             -> client.enableMic(false|true); nothing sent to the server
 *  - Voice Agent JSON events               -> RTVI callbacks (onUserInput, onBotOutput, onBotStartedSpeaking, ...)
 *  - vc.listen (Flux/Nova layer frames)    -> onServerMessage: vc.turn, vc.layer (+ vc.eager, vc.panel, vc.intel,
 *                                             vc.latency, vc.latency.breakdown, vc.usage, vc.config, vc.session)
 *  - client-side usage estimate            -> vc.usage from the server (UsageReport), saved with the strip
 *  - 3 s ListenUpdated ack timer           -> gone: vc.config answers every update
 *
 * The public surface below is what App.tsx, Toolbar.tsx and actions.ts call. Keep it; extend it if C2 needs more.
 */
export interface ComicSessionApi {
  /** Session id from vc.session, sent with POST /api/strips so the server-metered usage is saved. */
  readonly sessionId: string | null;
  /** Session clock in ms (0 = first mic audio sent). */
  now(): number;
  /** Mic permission first, then GET /api/session, then connect with the cfg built from store settings. */
  connect(): Promise<void>;
  /** Disconnect, finalize open panels, stamp usage.disconnectedAt. */
  stop(closeSocket?: boolean): void;
  /** Mic off (client.enableMic(false)) and flush local bot audio; the connection stays up. */
  pause(): void;
  resume(): void;
  /** vc.reset: Flux forgets the conversation, a divider is drawn; in a duet only the divider. */
  resetConversation(): Promise<void>;
  /** Diff settings and send one vc.update; an experience change reconnects with a new cfg. */
  applySettings(next: Settings, prev: Settings): void;
  /** Draw the typed line now, then vc.say. */
  injectText(text: string): void;
  /** Booth latch: drop any recorded audio and never record again this session. */
  dropRecording(): void;
  /** POST /api/strips (+ PUT audio unless booth). */
  save(title: string): Promise<{ id: string; url: string; booth?: boolean; expiresAt?: number }>;
}

const NOT_YET = 'The Pipecat session layer is not built yet (lane C1).';

export class ComicSession implements ComicSessionApi {
  sessionId: string | null = null;

  constructor(readonly catalog: Catalog) {}

  now() { return 0; }
  async connect(): Promise<void> { throw new Error(NOT_YET); } // TODO(C1)
  stop(_closeSocket = true) { store.set({ conn: 'closed', agentSpeaking: false }); } // TODO(C1)
  pause() { toast(NOT_YET); } // TODO(C1)
  resume() { toast(NOT_YET); } // TODO(C1)
  async resetConversation(): Promise<void> { toast(NOT_YET); } // TODO(C1)
  applySettings(_next: Settings, _prev: Settings) { /* TODO(C1): diff -> vc.update */ }
  injectText(_text: string) { toast(NOT_YET); } // TODO(C1)
  dropRecording() { /* TODO(C1) */ }
  async save(_title: string): Promise<{ id: string; url: string; booth?: boolean; expiresAt?: number }> { throw new Error(NOT_YET); } // TODO(C1)

  static fresh(catalog: Catalog) {
    store.set({ panels: [], resets: [], events: [], latency: {}, usage: emptyUsage(), saved: null, conn: 'idle', paused: false, lastSettings: null, voices: 0 });
    return new ComicSession(catalog);
  }
}
