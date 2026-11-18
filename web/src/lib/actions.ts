import type { ComicSessionApi } from './session';
import { store, toast } from './store';
import { duetListenKey } from './experience';
import type { Settings } from './types';

/** Single entry point for settings changes so keyboard shortcuts and the toolbar behave identically. */
export function changeSettings(session: ComicSessionApi | null, patch: Partial<Settings>) {
  const { settings: prev, catalog } = store.get();
  if (patch.booth === false && catalog?.booth?.enabled) patch = { ...patch, booth: true }; // the deployment forces booth mode; nobody can switch it off
  if (patch.experience && patch.experience !== prev.experience && store.get().conn === 'connecting') { toast('Still connecting, try the scene switch in a second'); return; } // the pipeline is being built; switching now would leave client and proxy disagreeing
  const next = { ...prev, ...patch };
  if (patch.booth && !prev.booth) { next.redact = true; session?.dropRecording(); } // booth mode starts with redaction on and forgets any audio, live or not
  if (patch.experience && patch.experience !== prev.experience && catalog) {
    // A duet needs Nova-3 (Flux has no diarization); coming back to Flux chat restores the default listen model, the star of the show.
    next.listenKey = next.experience === 'duet' ? duetListenKey(catalog, next.listenKey) : catalog.defaults.listen;
  }
  store.set({ settings: next });
  if (session && store.get().conn === 'live') session.applySettings(next, prev);
}
