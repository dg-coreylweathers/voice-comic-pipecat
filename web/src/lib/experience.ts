import type { Catalog, Experience, ExperienceKey, Settings } from './types';

/** The two-people experience: no Voice Agent, only a diarized Nova-3 stream. */
export const isDuet = (s: Settings) => s.experience === 'duet';
/** Whether the Nova layer splits panels by speaker: the Two speakers toggle, or always in a duet. */
export const isDiarized = (s: Settings) => s.speakers || isDuet(s);
export const findExperience = (catalog: Catalog | null, key: ExperienceKey | undefined): Experience | undefined => catalog?.experiences?.find((e) => e.key === key);

/** Flux has no diarization, so a duet runs the catalog's Nova-3 twin of the chosen listen model (the same `diarizedKey` the proxy uses). */
export function duetListenKey(catalog: Catalog, key: string) {
  const m = catalog.listen.find((l) => l.key === key);
  return m?.diarizedKey && catalog.listen.some((l) => l.key === m.diarizedKey) ? m.diarizedKey : key;
}
