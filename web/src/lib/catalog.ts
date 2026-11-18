import catalogFile from '../../../shared/catalog.json' with { type: 'json' };
import type { Catalog, FluxDials, ListenModel, LlmSettings, Money, Mode, Experience, SpeakModel, ThinkModel } from './types';

/**
 * Loader for shared/catalog.json, the single source of truth (Python reads the same file in server/vc/catalog.py).
 * At runtime the app still fetches GET /api/catalog, which is this file plus `event` and `booth`; the bundled
 * copy is for tests, Storybook-style screenshots and the offline cost explainer.
 */
export interface CatalogFile {
  schemaVersion: 1;
  listen: (ListenModel & { role: 'primary' | 'tap' })[];
  speak: SpeakModel[];
  think: (ThinkModel & { llm: LlmSettings; pricePer1MTokens: { input: Money; output: Money; cacheRead: Money; cacheWrite5m: Money } })[];
  modes: Mode[];
  experiences: Experience[];
  flux: FluxDials;
  rates: Catalog['rates'] & { llmAsOf: Money | string; llmSource: string };
  defaults: Catalog['defaults'];
}

export const PLACEHOLDER = '[fill from Claude docs]' as const;

/** A catalog price, or null while it is still a placeholder. */
export const priceOf = (v: Money | undefined): number | null => (typeof v === 'number' ? v : null);

const { $schema: _schema, ...file } = catalogFile as typeof catalogFile & { $schema?: string };
export const CATALOG_FILE = file as unknown as CatalogFile;

/** What GET /api/catalog returns, built locally (tests, offline pages). */
export function localCatalog(event = 'default', booth = { enabled: false, transcriptTtlHours: 2 }): Catalog {
  return { ...CATALOG_FILE, event, booth };
}
