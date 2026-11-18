import type { Catalog, Mode, Panel } from './types';

/** Resolve a mode key against the catalog; unknown keys fall back to the first mode. */
export const findMode = (catalog: Catalog | null, key: string | undefined): Mode | undefined => catalog?.modes?.find((m) => m.key === key) ?? (key === undefined ? undefined : catalog?.modes?.[0]);

/** Badge under a visitor: by diarized speaker index; speakers past the list reuse the last badge with a number (VISITOR 2, VISITOR 3). Badges come from the mode, or from the duet experience. */
export function speakerBadge(badges: string[] | undefined, panel: Panel) {
  if (!badges?.length) return undefined;
  const i = panel.speaker ?? 0, last = badges.length - 1;
  if (i <= last) return badges[i];
  return /\d+$/.test(badges[last]) ? badges[last].replace(/\d+$/, String(i + 1)) : `${badges[last]} ${i - last + 1}`; // SPEAKER 3, or VISITOR 3
}
