import { useSyncExternalStore } from 'react';
import type { Catalog, ConnState, Latency, Panel, Settings, Usage, XEvent } from './types';

export interface State {
  catalog: Catalog | null;
  settings: Settings;
  conn: ConnState;
  /** Mic muted while the socket stays alive. */
  paused: boolean;
  panels: Panel[];
  resets: number[];
  events: XEvent[];
  latency: Latency;
  usage: Usage;
  listenLayer: { state: string; model?: string; version?: string; url?: string };
  agentSpeaking: boolean;
  /** Distinct diarized speaker ids Nova has reported this session (streaming diarization warms up, so this grows). */
  voices: number;
  toast: string | null;
  saved: { id: string; url: string; booth?: boolean; expiresAt?: number } | null;
  consented: boolean;
  lastSettings: unknown | null;
  clock: number; // ticks every 250ms while live so the cost meter and reveal animate
}

export const initialSettings: Settings = {
  experience: 'agent',
  listenKey: 'flux-en',
  speakKey: 'flux-kit',
  thinkKey: 'claude-haiku-5-5',
  modeKey: 'visitor',
  keyterms: ['Deepgram', 'Flux', 'Nova'],
  redact: false,
  xray: false,
  booth: false,
  speakers: false,
};

export const emptyUsage = (): Usage => ({ listenMsByKey: {}, agentMsByTier: {}, ttsCharsByFamily: { flux: 0, aura: 0 }, redactMs: 0, keytermMs: 0 });

const initial: State = {
  catalog: null,
  settings: initialSettings,
  conn: 'idle',
  paused: false,
  panels: [],
  resets: [],
  events: [],
  latency: {},
  usage: emptyUsage(),
  listenLayer: { state: 'closed' },
  agentSpeaking: false,
  voices: 0,
  toast: null,
  saved: null,
  consented: false,
  lastSettings: null,
  clock: 0,
};

let state: State = initial;
const listeners = new Set<() => void>();

export const store = {
  get: () => state,
  set(update: Partial<State> | ((s: State) => Partial<State>)) {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  reset() { store.set({ ...initial, catalog: state.catalog, settings: state.settings, consented: state.consented }); },
};

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state), () => selector(state));
}

export function updatePanel(id: string, patch: Partial<Panel> | ((p: Panel) => Partial<Panel>)) {
  store.set((s) => ({ panels: s.panels.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)) }));
}

// Events arrive many times per second from two Deepgram streams; batch them so React redraws at most ~12 Hz.
const pendingEvents: XEvent[] = [];
let flushTimer: number | null = null;
export function pushEvent(e: XEvent) {
  pendingEvents.push(e);
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    const batch = pendingEvents.splice(0);
    store.set((s) => { const next = s.events.concat(batch); return { events: next.length > 4000 ? next.slice(-3000) : next }; });
  }, 80);
}

export function toast(msg: string) {
  store.set({ toast: msg });
  setTimeout(() => store.set((s) => (s.toast === msg ? { toast: null } : {})), 4000);
}
