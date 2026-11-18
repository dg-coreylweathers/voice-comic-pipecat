export type Role = 'user' | 'agent';
export type Version = 'v1' | 'v2';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Word { word: string; start: number; end: number; confidence?: number }

export interface Intel { sentiment: Sentiment; score: number; intents: string[]; topics: string[] }

export interface Panel {
  id: string;
  role: Role;
  text: string;
  final: boolean;
  words?: Word[];
  /** Session-clock ms (0 = first mic chunk sent). */
  startedAt: number;
  endedAt?: number;
  model: string;
  version: Version;
  langs?: string[];
  intel?: Intel;
  redacted?: boolean;
  /** Agent panels: how many characters have been "spoken" so far. */
  spokenChars?: number;
  /** Agent panels: char index where the visitor interrupted. */
  interruptedAt?: number;
  /** Agent panels: session-clock ms when the first TTS audio was scheduled. */
  spokenAt?: number;
  /** User panels: set once the agent's own ConversationText has been merged in. */
  reconciled?: boolean;
  paceWps?: number;
  /** Agent panels: ms from the visitor's end of turn to first TTS audio. */
  latencyMs?: number;
  /** User panels: diarized speaker index (two-speaker strips) and the mode that was active, for the badge. */
  speaker?: number;
  mode?: string;
  // ---- Pipecat beats (contract between lanes C1 and C2; C1 fills them, C2 draws them) ----
  /** Visitor panels: perception signals from RTVI user-input (beat 1). Raw values show only in the X-ray. */
  perception?: PerceptionSignal[];
  /** Visitor panels: ghost bubble state from vc.eager (beat 2). */
  ghost?: { phase: 'predicted' | 'withdrawn' | 'released'; transcript?: string; heldMs?: number };
  /** Agent panels: assistantTurn from onBotLlmStarted, matches vc.panel / vc.latency. */
  assistantTurn?: number;
  /** Agent panels: Claude's own panel tag (beat 3), applied once revealed chars reach `at`. */
  tag?: { mood: string; sfx?: string; caption?: string; at: number; applied?: boolean };
  /** Agent panels: "mhm" style acknowledgements heard while it spoke (beat 4, RTVI input_type backchannel). */
  backchannels?: { text: string; t: number }[];
  /** Agent panels: the reply was a released speculation (beat 2) and the latency breakdown (beat 5). */
  eager?: boolean;
  latencyBreakdown?: { totalMs: number; parts: { key: string; label: string; ms: number }[] };
}

/** RTVI 2.3.0 perception signal (client-js UserPerceptionSignal), e.g. {name:'tone', labels:[{label:'frustrated', confidence:0.8}]}. */
export interface PerceptionSignal { name: string; labels?: { label: string; confidence: number }[]; value?: number }

export interface XEvent { t: number; src: 'agent' | 'listen' | 'proxy' | 'client'; type: string; summary: string; raw?: unknown }

/** Shapes of shared/catalog.json as served by GET /api/catalog. The strict file type is CatalogFile in catalog.ts; fields marked optional here are
 * required in the file but optional in this legacy view so the copied fixtures keep compiling (lane C2 tightens them). */
export interface ListenModel { key: string; version: Version; model: string; language?: string; label: string; family: 'flux' | 'nova'; /** primary = may feed Claude (Flux only); tap = Nova branch / duet only. */ role?: 'primary' | 'tap'; ratePerMin: number; regularPerMin?: number; /** The Nova-3 twin that runs when redaction or diarization is needed (Flux entries only). */ diarizedKey?: string; blurb: string }
export interface SpeakModel { key: string; version: Version; model: string; label: string; family: 'flux' | 'aura'; ratePer1k: number; regularPer1k?: number }
export type Tier = 'standard' | 'advanced';
/** A catalog price that is still `[fill from Claude docs]` is unknown: show 'price pending', never a number. */
export type Money = number | '[fill from Claude docs]';
export interface LlmSettings { effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null; thinking: { type: 'disabled' | 'enabled' | 'between_tools' | 'adaptive'; budgetTokens?: number } | null; maxTokens: number }
export interface ThinkModel { key: string; provider: string; model: string; label: string; /** The Voice Agent tier this model would bill at (comparison only). */ tier: Tier; llm?: LlmSettings; pricePer1MTokens?: { input: Money; output: Money; cacheRead: Money; cacheWrite5m: Money } }
export interface Range { min: number; max: number; step: number; default: number }
export interface FluxDials { eotThreshold: Range; eagerEotThreshold: Range; eotTimeoutMs: number }
export interface Mode { key: string; label: string; /** Fits the toolbar select. */ short: string; /** By diarized speaker index; extra speakers reuse the last badge with a number. */ badges: string[]; blurb: string }
/** `agent`: talk with Flux over the Voice Agent API. `duet`: no agent; Nova-3 diarization draws two people talking to each other. */
export type ExperienceKey = 'agent' | 'duet';
export interface Experience { key: ExperienceKey; label: string; short: string; badges?: string[]; blurb: string }
export interface Catalog {
  listen: ListenModel[];
  speak: SpeakModel[];
  think: ThinkModel[];
  modes: Mode[];
  experiences: Experience[];
  /** Themes tally label for this deployment. */
  event: string;
  /** Flux turn-taking slider ranges (beat 4). */
  flux?: FluxDials;
  rates: { asOf: string; source: string; promoEnds: string; llmAsOf?: string; llmSource?: string; agentPerMinByTier: Record<Tier, { label: string; promo: number; regular: number }>; redactionPerMin: number; keytermPerMin: number; /** Listed as included. */ diarizationPerMin?: number };
  defaults: { listen: string; speak: string; think: string; mode: string };
  /** Server-side booth mode: forced for every strip when enabled. */
  booth: { enabled: boolean; transcriptTtlHours: number };
}

export interface Settings { experience: ExperienceKey; listenKey: string; speakKey: string; thinkKey: string; modeKey: string; keyterms: string[]; redact: boolean; xray: boolean; booth: boolean; speakers: boolean; /** Flux turn-taking dials (beat 4); undefined = catalog defaults. */ flux?: { eotThreshold?: number; eagerEotThreshold?: number } }

export type ConnState = 'idle' | 'connecting' | 'live' | 'closed';

export interface ThemeTerm { term: string; count: number; sentiment: number; firstAt: number; lastAt: number }
export interface Themes { event: string; turns: number; topics: ThemeTerm[]; intents: ThemeTerm[]; categories: ThemeTerm[]; events: { event: string; turns: number; from: string; to: string }[] }

export interface Latency { stt?: number; ttt?: number; tts?: number; total?: number }

export interface Usage {
  /** Which pipeline ran; missing means the agent experience (older strips). A duet has no agent minutes at all. */
  experience?: ExperienceKey;
  connectedAt?: number;            // wall clock ms
  disconnectedAt?: number;
  listenMsByKey: Record<string, number>;   // ms of layer time per listen model key
  agentMsByTier?: Partial<Record<Tier, number>>; // ms of agent connection per LLM tier
  ttsCharsByFamily: { flux: number; aura: number };
  redactMs: number;
  keytermMs: number;
  /** true when the proxy metered this usage (saved strips), false/undefined for the live client estimate */
  server?: boolean;
}

export interface SavedStrip {
  id?: string;
  title: string;
  createdAt?: number;
  hasAudio?: boolean;
  booth?: boolean;
  expiresAt?: number;
  panels: Panel[];
  /** Session-clock ms where the operator reset the conversation (drawn as dividers). */
  resets?: number[];
  events: XEvent[];
  settings: Settings;
  usage: Usage;
  durationMs: number;
}
