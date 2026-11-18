# Architecture: Voice Comic on Pipecat

Status: scaffold, 2026-11-18. Contracts in this file and in `shared/` are frozen for the first build round; change them only by a PR that updates the schema, both type mirrors and the shared examples together (the contract tests fail otherwise).

Inputs this design commits to: the parity port plan and the six Pipecat-native beats (goal docs `plan.md` and `concept.md`, both scrutinized), Pipecat 1.16.0 at `ee48754`, `@pipecat-ai/client-js` 1.16.0, `@pipecat-ai/websocket-transport` 1.8.2 (RTVI 2.3.0).

## 1. Topology

```
Browser (React + SVG comic, PipecatClient + WebSocketTransport, Protobuf frames)
   │  GET /api/session -> {token}          (HMAC, 1 h, 20/min/IP)
   │  WS  /api/agent?token=..&cfg=..       (cfg = base64url SessionConfig)
   ▼
Fly machine dg-voice-comic-pipecat (one always-on shared-cpu-2x, 2 GB, volume /data)
   python -m vc  ->  uvicorn  ->  FastAPI app (vc.app)
       ├─ HTTP: catalog, strips, themes, health, static client (web/dist)
       ├─ SQLite /data/strips.db (+ /data/audio/*.wav)
       └─ one Pipecat pipeline per WebSocket (vc.pipeline.bot.run_bot), at most MAX_SESSIONS at once
            ├─ wss://api.deepgram.com/v2/listen   Flux STT (primary, eager end of turn)
            ├─ wss://api.deepgram.com/v1/listen   Nova-3 tap (only while Redact or Two speakers; whole duet)
            ├─ wss://api.deepgram.com/v2/speak    Flux TTS  │ one ServiceSwitcher
            ├─ wss://api.deepgram.com/v1/speak    Aura-2    │
            ├─ POST https://api.deepgram.com/v1/read   topics + intents, fire-and-forget
            └─ https://api.anthropic.com           Claude (Haiku 5.5 / Sonnet 5.5), no tools
```

Keys (`DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`) live only in the server process environment. The browser holds a short-lived token and catalog keys, nothing else.

## 2. Module boundaries

### server/vc (Python 3.12 package, `pipecat-ai[deepgram,anthropic,websocket,silero,tone]==1.16.0`)

| Module | Lane | Responsibility |
|---|---|---|
| `config.py`, `logs.py`, `paths.py` | S2 / frozen | Environment to a frozen `Config` (secrets never in `repr`); loguru level (WARNING in booth); where `shared/` and `web/dist` are. Same relative layout in the repo and the image. |
| `app.py`, `api.py` | S2 | FastAPI factory: lifespan opens Store, Themes, the shared `aiohttp.ClientSession`, the purge task and builds `BotDeps`; HTTP routes ported from the Node `index.js`; WS `/api/agent` verifies the token and decodes `SessionConfig` before `accept`, then calls `run_bot`. Static client with SPA fallback; unknown `/api/*` answers JSON 404. |
| `auth.py`, `ratelimit.py` | S2 | Stateless HMAC session tokens (`{exp}.{sig}`, now read from the `token` query parameter the Pipecat JS transport sends) and the per-IP fixed-window limiter. |
| `store.py`, `themes.py`, `privacy.py` | S2 | SQLite strips and audio with booth TTL and purge; the themes tally (taxonomy, entity filter, CSV); `sanitize_strip` for permalinks. Straight ports of the Node modules with their tests. |
| `prompts.py` | S2 | The only place prompt text lives: persona, modes, Q&A fact sheet from the catalog, privacy add-on, and the panel-tag instructions built from `protocol.PanelMood` / `PanelSfx`. Implements `deps.PromptBook`. |
| `catalog.py` | frozen | Pydantic loader for `shared/catalog.json`, lookups, `public_catalog()` for `GET /api/catalog`, `price()` that maps placeholders to `None`. |
| `protocol.py` | frozen | Pydantic mirror of `shared/protocol.schema.json`: every `vc.*` message, `SessionConfig`, `UsageReport`; `parse_client_message`, `SessionConfig.from_query`. |
| `deps.py` | frozen | The seams between lanes: `BotDeps`, `ThemesSink`, `PromptBook`, `UsageRegistry`, `ThemeTurn`. |
| `redaction.py` | frozen | Reads the redaction-token regex out of `shared/redaction.js` so server and browser share one grammar. |
| `prefetch.py` | frozen | Downloads the perception models into `HF_HOME` at `docker build`. |
| `sessions.py` | S1 | In-memory `UsageReport` by session id, 2 h TTL (replaces the Node `usageBook`). |
| `pipeline/bot.py` | S1 | Builds and runs one pipeline per connection (agent or duet), registers handlers and observers, sends `vc.session`, the greeting, and the final usage. |
| `pipeline/services.py` | S1 | Service factories from catalog entries; `llm_settings_for(think)` returns the full settings delta for a live model switch. |
| `pipeline/controls.py` | S1 | `vc.update` / `vc.say` / `vc.reset` to Pipecat frames; answers `vc.config` or `vc.error`. |
| `pipeline/perception.py` | S1 | The only importer of `pipecat.expressive` (alpha). Builds the `PerceptionReader`. |
| `pipeline/eager.py`, `observers/eager_observer.py` | S1 | Ghost-bubble events (`vc.eager`). |
| `pipeline/processors/*` | S1 | `TurnTap`, `NovaGate`, `NovaTap`, `BackchannelDetector`, `ThemesIntel`, `RedactScrub`, `PanelTagHandler` + SFX one-shots. |
| `pipeline/observers/*` | S1 | `TurnLatencyObserver`, latency-breakdown handler, `EagerObserver`, `UsageObserver`. |
| `pipeline/stages.py`, `pipeline/messages.py` | S1 | The X-ray's pipeline view; the one helper that pushes a `vc.*` model as an `RTVIServerMessageFrame`. |

### web/src (React 19, Vite 6, TypeScript 5.8)

| Module | Lane | Responsibility |
|---|---|---|
| `lib/protocol.ts`, `lib/catalog.ts` | frozen | TS mirror of the protocol schema with `FIELDS` for the parity test, `sendVc`, `encodeSessionConfig`; typed loader for the bundled `shared/catalog.json`. |
| `lib/session.ts` | C1 | `ComicSession`: owns `PipecatClient`, mic, playback, recording; maps RTVI callbacks and `vc.*` messages to panels (section 5.4). Scaffold is a stub with the public interface `ComicSessionApi`. |
| `lib/director.ts` | C1 (perception mapping), C2 (art) | Signals to expression, bubble, SFX, captions and micro-labels. C1 adds the perception mapping (section 5.5); C2 owns the visual rules. |
| `lib/store.ts`, `lib/actions.ts`, `lib/types.ts`, `lib/wav.ts`, `App.tsx` | C1 | App state, the single settings entry point, panel and settings types (the beat fields are already declared), the recording mixer. |
| `comic/*`, `ui/*`, `lib/pricing.ts`, `styles.css` | C2 | The comic engine and every page: ghost bubble, backchannel bubble, Flux dials, latency pill, panel/audio sync visuals, X-ray rows, cost modal. |

### shared/

| File | Read by | What |
|---|---|---|
| `catalog.json` + `catalog.schema.json` | `vc.catalog`, `web/src/lib/catalog.ts`, `GET /api/catalog` | Models, list prices (Claude prices are `[fill from Claude docs]` until verified), modes, scenes, Flux dial ranges, defaults. |
| `protocol.schema.json` | both contract tests | The `vc.*` contract (section 5). |
| `protocol.examples.json` | both contract tests | One valid example per message. |
| `redaction.js` (+ `.d.ts`) | `vc.redaction`, `web/src/lib/director.ts` | Deepgram redaction-token grammar. |

## 3. The pipeline

### 3.1 Agent experience

```
FastAPIWebsocketTransport(ws, FastAPIWebsocketParams(serializer=ProtobufFrameSerializer(),
                          audio_in_enabled=True, audio_out_enabled=True, add_wav_header=False))
transport.input()
  -> ParallelPipeline(
       [flux_stt: DeepgramFluxSTTService(enable_eager_end_of_turn=True, settings: model, eot_threshold,
                  eager_eot_threshold, eot_timeout_ms, keyterm, redact="numbers" when Redact; mip_opt_out),
        turn_tap: TurnTap],                                             -> vc.turn
       [nova_gate: NovaGate (audio only while Redact or Two speakers),
        nova_stt: DeepgramSTTService(nova-3, interim_results, smart_format,
                  redact=["pii","pci","numbers"] when Redact, diarize when Two speakers; mip_opt_out),
        nova_tap: NovaTap (consumes Transcription/InterimTranscription)])  -> vc.layer, vc.layer.status
  -> perception: PerceptionReader(sources=[PipecatToneSource(), PipecatVoiceSource()])   beat 1
  -> backchannel: BackchannelDetector                                                      beat 4
  -> user_aggregator: LLMContextAggregatorPair(context,
         user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer(),
             user_turn_strategies=FilterIncompleteUserTurnStrategies(),
             user_turn_strategies_params=UserTurnStrategiesParams(start_merge_mode=MergeMode.EXTEND,
                                                                  stop_merge_mode=MergeMode.EXTEND)))
     (same shape as examples/voice/voice-deepgram-flux-eager.py)
     (Flux's recommended EagerUserTurnStrategies stay in charge; VAD supplies frames and can withdraw a speculation)
  -> themes_intel: ThemesIntel                                     -> vc.intel (async task, off the frame path)
  -> redact_scrub: RedactScrub                                     (what RTVI shows, never what Claude gets)
  -> llm: AnthropicLLMService(settings: model, system_instruction=prompt_for(mode, redact), max_tokens,
          enable_prompt_caching=True, thinking/effort from the catalog)        no tools, ever
  -> panel_tags: LLMTextProcessor(text_aggregator=PatternPairAggregator())  "<panel" ... "/>" removed
          + PanelTagHandler                                         -> vc.panel + one-shot SFX audio   beats 3, 6
  -> tts: ServiceSwitcher(services=[DeepgramFluxTTSService(voice), DeepgramTTSService(voice=aura-2-*)])
  -> transport.output()
  -> assistant_aggregator

PipelineWorker(pipeline,
  params=PipelineParams(audio_in_sample_rate=16000, audio_out_sample_rate=24000, enable_metrics=True,
                        enable_usage_metrics=True, enable_expressive_conversation=True),
  observers=[TurnLatencyObserver -> vc.latency,
             UserBotLatencyObserver (+ on_latency_breakdown handler) -> vc.latency.breakdown,
             EagerObserver -> vc.eager (withdrawn/released),
             UsageObserver -> vc.usage],
  rtvi_observer_params=RTVIObserverParams(ignored_sources=[nova_stt, nova_tap]))
handlers: flux_stt.on_eager_end_of_turn -> vc.eager(predicted); flux_stt.on_turn_resumed -> vc.eager(withdrawn)
          rtvi.on_client_ready -> vc.session, then greeting (developer message + LLMRunFrame) unless cfg.quiet
          rtvi.on_client_message -> controls.handle
```

Never added, in any mode: `TranscriptionLogObserver`, `AudioBufferProcessor`, tools/function schemas, `TurnTraceObserver` with an exporter that leaves the machine (tracing is a backstage, opt-in follow-up).

### 3.2 Duet experience

`transport.input() -> nova_stt (diarize=True, redact when Redact) -> nova_tap -> transport.output()`. No LLM, no TTS, no perception, no user aggregator. `vc.session` is sent on client-ready; `vc.layer.status open` is the client's go-live signal. `vc.say` is refused with `vc.error`. `vc.reset` only bumps the panel epoch.

### 3.3 Why it is shaped this way

- **Nova is a sibling branch, never in the LLM path.** Its transcription frames would otherwise reach the user aggregator as a second user turn. `NovaTap` consumes them; both Nova processors are in `ignored_sources` so RTVI does not report them as user input. Under Redact, Claude still hears Flux's unredacted text (as before); `PRIVACY_PROMPT` asks it not to echo details.
- **Nova toggling without a rebuild.** `ParallelPipeline` branches are fixed at construction, so the Nova branch always exists in the agent pipeline and `NovaGate` decides whether audio flows. Turning Redact or Two speakers on flips the gate and sends `STTUpdateSettingsFrame` (redact/diarize, a reconnect) to `nova_stt`. Idle, Nova bills nothing (STT usage counts audio sent) and keeps its own 5 s KeepAlive. Spike gate: the idle Nova socket survives, and the first words after enabling are not lost.
- **Flux keeps turn detection.** User turn strategies are EXTENDed, not replaced, so Flux's eager strategy still starts and stops turns; Silero exists for the voice perception clip and `UserBotLatencyObserver`.
- **Two latency numbers.** `vc.latency` (custom, Flux end of turn to first bot audio) is the headline "replied in" stamp, closest to the old definition. `vc.latency.breakdown` (Pipecat's `UserBotLatencyObserver`, VAD stop to first bot audio, with per-service parts) feeds the pill and X-ray.
- **No tools.** Any tool call cancels eager speculation and costs a second inference; panel mood, SFX and caption ride inline tags.
- **Model switches send full LLM settings.** `llm_settings_for(think)` sets model, thinking and effort together, clearing whichever the new model does not use, because Sonnet 5.5 rejects `thinking=disabled` and Haiku 5.5 runs at `effort=low`.

## 4. Connection lifecycle

1. Client: mic permission, then `GET /api/session` for a token.
2. `client.connect({ wsUrl: '/api/agent?cfg=' + encodeSessionConfig(cfg), token })`. The transport appends `&token=`.
3. Server: token invalid → close 4401 before accept; `cfg` invalid → 4400; no free slot → 1013 "busy". Otherwise accept and build the pipeline for `cfg.experience`.
4. RTVI handshake (`client-ready` / `bot-ready`), then `vc.session {id, config, pipeline}`, then the greeting unless `quiet`.
5. Live: RTVI audio and messages both ways; `vc.update` answered by `vc.config`; `vc.usage` at most once a second.
6. Pause: `client.enableMic(false)`. Nothing is sent to the server. No STT seconds accrue. Flux idle behaviour after a long pause is a spike item (plan.md gate e).
7. New conversation: `vc.reset` (no reconnect). Scene change: disconnect and connect with a new `cfg`; the strip and the client-side usage view carry on, the server meters each connection separately and the client sums them for the strip.
8. Disconnect: the bot puts its final `UsageReport` in `deps.usage` under the session id; `POST /api/strips {sessionId}` uses it.

Reconnects: the JS transport's ReconnectingWebSocket may redial on a drop. A redial is a new pipeline (new session id). C1 treats a second `vc.session` as a reconnect: bump epoch, keep panels, merge usage.

## 5. The browser/server contract

Source of truth: `shared/protocol.schema.json`. Mirrors: `server/vc/protocol.py` (pydantic) and `web/src/lib/protocol.ts` (TypeScript). Checked by `server/tests/test_protocol_schema.py` and `web/src/lib/protocol.test.ts`, both of which validate `shared/protocol.examples.json`.

### 5.1 Envelope

- **Server to client:** `RTVIServerMessageFrame(data=msg.wire())` → RTVI `server-message` → `onServerMessage(data)` → `asServerMessage(data)`.
- **Client to server:** `sendVc(client, {type, ...data})` → `client.sendClientMessage(type, data)` → RTVI `client-message` → `RTVIProcessor.on_client_message` → `parse_client_message(type, data)`. Anything that does not parse, including any non-`vc.*` type, is answered with `vc.error` and dropped.
- **Session config:** once, as `cfg` (unpadded base64url JSON) on the WS URL. An experience change is a new connection.
- Wire names are camelCase. `protocolVersion` is 1.

### 5.2 Standard RTVI messages the client consumes (not redefined)

| RTVI (client-js callback) | Used for |
|---|---|
| `user-input` (`onUserInput`), final with `perception` | Visitor mood (beat 1); attaches to the newest final visitor panel without perception, within 20 s. Interim user-input is ignored (vc.turn is richer). Under Redact its text is the scrub placeholder. |
| `user-input` with `input_type: "backchannel"` | Backchannel bubble on the current agent panel (beat 4). |
| `bot-llm-started` (`onBotLlmStarted`) | Creates the agent panel, `assistantTurn += 1`, "thinking..." until audio. |
| `bot-output` (`onBotOutput`, `spoken_status`, `segment_id`) | Agent text, segment by segment (Flux TTS has no word timestamps); reveal stays 15 chars/s from first audio. |
| `bot-started-speaking` / `bot-stopped-speaking` | Reveal clock start; finalize panel. |
| `bot-interrupted` / `user-started-speaking` | Barge-in: `interruptedAt = revealedChars`, strike-through, surprised face, "you interrupted". |
| `metrics` (`onMetrics`) | X-ray only (TTFB rows). Keys beyond the typed ones (`tokens`, `stt_usage`) arrive untyped. |

### 5.3 vc.* messages

| Message | Direction | When | Key fields |
|---|---|---|---|
| `vc.session` | S→C | after client-ready | `id` (metering key), `protocolVersion`, `experience`, `config`, `pipeline[]` (X-ray) |
| `vc.config` | S→C | after every `vc.update` / `vc.reset` | effective `config`, `changes[] {field, frame, live}`, refreshed `pipeline[]` |
| `vc.turn` | S→C | every Flux TurnInfo (StartOfTurn, Update, EagerEndOfTurn, TurnResumed, EndOfTurn) | `panelId` = `u-{epoch}-{turnIndex}`, `transcript`, `words[] {word,start,end,confidence}`, `endOfTurnConfidence`, `languages` |
| `vc.eager` | S→C | Flux predicted / withdrew / the held reply was released | `panelId`, `phase`, `transcript` (predicted only), `reason`, `heldMs` |
| `vc.layer` | S→C | Nova interim and final (per diarized speaker run) | `panelId` = `n-{epoch}-{seq}`, `isFinal`, `speechFinal`, `transcript`, `words[]` with `speaker`, `speaker`, `redacted` |
| `vc.layer.status` | S→C | Nova branch opens, closes, errors, changes settings | `state`, `key`, `model`, `redact[]`, `diarize`, `message` |
| `vc.intel` | S→C | /v1/read returns for a finished visitor turn | `panelId`, `topics[≤3]`, `intents[≤3]`, optional `sentiment`, `score` |
| `vc.panel` | S→C | Claude's `<panel .../>` tag was parsed | `assistantTurn`, `at` (char offset in spoken text), `mood`, `sfx`, `caption` |
| `vc.latency` | S→C | first bot audio of a turn | `assistantTurn`, `ms`, `from` (`flux_end_of_turn` / `typed_line`), `eager` |
| `vc.latency.breakdown` | S→C | `UserBotLatencyObserver.on_latency_breakdown` | `assistantTurn`, `totalMs`, `userTurnMs`, `parts[] {key,label,owner,ms}` |
| `vc.usage` | S→C | at most 1/s while metrics flow, and on disconnect | `usage: UsageReport` (section 5.6) |
| `vc.error` | S→C | invalid client message, service failure | `message` (scrubbed), `source`, `fatal` |
| `vc.update` | C→S | toolbar / hotkey change | any of `listenKey`, `speakKey`, `thinkKey`, `modeKey`, `keyterms`, `redact`, `speakers`, `flux {eotThreshold, eagerEotThreshold}` |
| `vc.say` | C→S | operator typed a line | `id` (`k-...`, echoed in `vc.intel`), `text` ≤ 400 |
| `vc.reset` | C→S | New conversation | `quiet` |

`vc.update` field to frame (implemented in `pipeline/controls.py`):

| Field | Frame | Live or reconnect |
|---|---|---|
| `listenKey` (Flux en ↔ multi) | `STTUpdateSettingsFrame(model)` on flux_stt; epoch++ | reconnect (waits for the user to stop) |
| `keyterms` | `STTUpdateSettingsFrame(keyterm)` on flux_stt (+ nova_stt if open) | live Configure on Flux |
| `flux.eotThreshold`, `flux.eagerEotThreshold` | `STTUpdateSettingsFrame` on flux_stt; server clamps eager < eot | live Configure |
| `speakKey`, same family | `TTSUpdateSettingsFrame(voice, service=member)` | Flux: reconnect, loses acoustic state |
| `speakKey`, other family | voice update on the target member, then `ManuallySwitchServiceFrame(service=member)` | switch; standby member may need its first reconnect |
| `thinkKey` | `LLMUpdateSettingsFrame(delta=llm_settings_for(think))` | live |
| `modeKey`, `redact` | `LLMUpdateSettingsFrame(system_instruction=prompt_for(mode, redact))` | live |
| `redact`, `speakers` | NovaGate on/off + `STTUpdateSettingsFrame(redact, diarize)` on nova_stt; Flux `redact=numbers` reconnect | Nova reconnect |

### 5.4 Panel rules the client implements (C1)

- **Visitor panels, Flux mode** (Redact and Two speakers off): created by the first `vc.turn` for a `panelId` with text or `StartOfTurn`; updated on `Update`; finalized on `EndOfTurn` (text, words, pace = words / span). `vc.eager` sets `panel.ghost`.
- **Visitor panels, Nova mode** (Redact or Two speakers on, and the whole duet): built from `vc.layer` exactly as the old `onNova` did (a final with a different `speaker` closes the open panel; the first final adopts its speaker). `vc.turn` still arrives with timing but **empty transcript and no words** under Redact (privacy), so it creates no panel.
- **Agent panels:** created on `onBotLlmStarted` (`assistantTurn = ++count`); text from `bot-output`; `spokenAt` from `onBotStartedSpeaking`; `vc.panel` stored as `panel.tag` and applied when `revealedChars >= at`; `vc.latency` → `latencyMs`, `eager`; `vc.latency.breakdown` → `latencyBreakdown`; `onBotStoppedSpeaking` finalizes; barge-in as in 5.2.
- **Typed line:** drawn immediately with id `k-{Date.now()}`, then `vc.say`. No echo comes back.
- **Intel:** `vc.intel.panelId` updates that panel's caption (`re: topic`) and, if present, sentiment for the X-ray.
- **Usage:** `vc.usage` replaces the live meter (C2 migrates `pricing.ts` from the old `Usage` to `UsageReport`).

### 5.5 Perception to expression (C1 maps, C2 draws)

Signals (RTVI `UserPerceptionSignal`): voice `tone` (positive, neutral, sad, frustrated), `arousal` 0..1, `laughter` 0..1, `speech_rate`, `sarcasm_voice`; text `emotion` (about 9 labels), `sarcasm` 0..1. Starting thresholds, tuned by C2 against the fixtures:

| Condition (first match wins) | Face | SFX / bubble | Micro-label (comic voice) |
|---|---|---|---|
| `laughter >= 0.5` | happy (laughing art when it exists) | HA HA | cracking up |
| `max(sarcasm, sarcasm_voice) >= 0.6` | smug (falls back to neutral) | | not buying it |
| tone frustrated `>= 0.5`, or emotion angry / disgusted / contemptuous top label | upset | UGH | not thrilled |
| tone sad `>= 0.5`, or emotion sad top label | upset | | sounds down |
| tone positive `>= 0.5`, or emotion happy / amused top label | happy | | sounded happy |
| otherwise | neutral | | heard you |
| `arousal >= 0.75` (independent) | | shout bubble | |

Raw values appear only in the X-ray. Clips under 0.8 s carry text signals only.

### 5.6 UsageReport and the cost modal

Server-metered per connection by `UsageObserver` from `MetricsFrame`: `sttSecondsByKey` (Flux primary and Nova tap separately, from `STTUsageMetricsData`), `ttsCharsByKey` / `ttsCharsByFamily` (`TTSUsageMetricsData`, attributed to the active switcher member), `llmByKey` (`LLMUsageMetricsData` tokens including cache read/write, attributed to the model active at the time because the metric carries no model name; `withdrawnCalls` counts discarded speculations), `connectedMs` and `connectedMsByTier` (for the comparison only), `redactSeconds`, `keytermSeconds`.

The cost modal (C2) shows two bars: **Pipecat à la carte** = STT seconds × rate + TTS characters × rate + Claude tokens × list price + add-ons; **Voice Agent API equivalent** = `connectedMsByTier` × `agentPerMinByTier[tier].regular` + the Nova tap minutes it would also have needed. A placeholder price renders as "price pending", never as zero.

## 6. catalog.json

Schema: `shared/catalog.schema.json` (JSON Schema 2020-12). Top level: `schemaVersion`, `listen[]`, `speak[]`, `think[]`, `modes[]`, `experiences[]`, `flux`, `rates`, `defaults`.

- `listen[]`: `key`, `family` (flux/nova), `version` (v2/v1 endpoint), `model`, `language` (Nova), `label`, `role` (`primary` = may feed Claude, Flux only; `tap` = Nova branch or duet only), `ratePerMin`, `regularPerMin`, `diarizedKey` (primary → its Nova twin), `blurb`.
- `speak[]`: `key`, `family` (flux → `DeepgramFluxTTSService`, aura → `DeepgramTTSService`), `version`, `model` (voice id), `label`, `ratePer1k`, `regularPer1k`.
- `think[]`: `key`, `provider` (anthropic), `model`, `label`, `tier` (Voice Agent tier for the comparison), `llm {effort, thinking, maxTokens}` (exactly one of effort/thinking set; sent in full on every switch), `pricePer1MTokens {input, output, cacheRead, cacheWrite5m}` (number or `"[fill from Claude docs]"`).
- `modes[]` / `experiences[]`: labels, badges, blurbs (prompt text stays in `prompts.py`).
- `flux`: slider ranges for `eotThreshold` (0.5..0.9, default 0.7) and `eagerEotThreshold` (0.3..0.9, default 0.5), `eotTimeoutMs`.
- `rates`: `asOf`, `source`, `promoEnds` (kept so the copied `pricing.ts` works), `agentPerMinByTier`, `redactionPerMin`, `keytermPerMin`, `diarizationPerMin`, `llmAsOf`, `llmSource`.
- `defaults`: `listen`, `speak`, `think`, `mode`.

`GET /api/catalog` = the file minus `$schema`, plus `event` and `booth {enabled, transcriptTtlHours}`.

## 7. Booth privacy checklist

Every item is an acceptance criterion somewhere in LANES.md.

- [ ] `BOOTH_MODE=1` sets loguru to WARNING; Pipecat's DEBUG lines with bot text (`Generating TTS [...]`) and Flux TRACE transcripts never print. (S2, `logs.py`)
- [ ] No `TranscriptionLogObserver`, no `AudioBufferProcessor`, no tracing exporter in any pipeline. (S1, asserted by a test that walks the built pipeline and observers)
- [ ] No tools or function schemas registered on the LLM. (S1, same test)
- [ ] Under Redact: `vc.turn` and `vc.eager` carry no transcript or words; RTVI `user-input` text is the scrub placeholder; only `vc.layer` (Nova, redacted) carries visitor text to the browser. (S1)
- [ ] `PRIVACY_PROMPT` is in the system instruction whenever Redact is on, and toggling Redact updates it live. (S1 + S2)
- [ ] `mip_opt_out` from `MIP_OPT_OUT` is passed to every Deepgram service. (S1)
- [ ] Client keeps no audio buffers in booth mode (per-session latch), uploads none; `PUT /api/strips/:id/audio` answers 403 for booth. (C1, S2)
- [ ] `sanitize_strip` for booth and redacted strips: events dropped (booth), text-bearing event summaries omitted (redact, now including `vc.turn`, `vc.layer`, `vc.intel`, `user-input`, `bot-output`), entity topics filtered or bucketed, title neutralised. (S2)
- [ ] Booth strips expire after `STRIP_TTL_HOURS` (purge every 15 min plus read-time 404). (S2)
- [ ] Themes keep terms and counts only; visitor text is matched and forgotten; only pipeline-finalized turns are tallied (no client message can add one). (S1 + S2)
- [ ] `vc.error.message` never includes transcript text or keys. (S1)
- [ ] Nothing remembered across visitors: no persistent context, no RAG; `vc.reset` clears the LLM context. (S1)
- [ ] Perception labels on screen are in the comic's voice; raw labels only in the X-ray. (C1, C2)
- [ ] Consent screen states that Claude hears unredacted speech even with Redact on, and that perception runs on the visitor's voice locally on the server. (C2)

## 8. Test strategy

| Layer | Where | Runs with | Needs keys |
|---|---|---|---|
| Contract tests | `server/tests/test_protocol_schema.py`, `test_catalog.py`; `web/src/lib/protocol.test.ts`, `catalog.test.ts` | `make docker-test` | no |
| Python unit | `server/tests/` (pytest, pytest-asyncio, httpx TestClient, temp DATA_DIR). Pipeline processors tested with Pipecat's frame test helpers and fake services: no network | `make docker-test` | no |
| TS unit | `web/src/**/*.test.ts` (`node --test --experimental-strip-types`): director/perception mapping, session mapping with a fake client, pricing, layout, cast | `make docker-test` | no |
| Image gate | `docker build` + `/health` on the image (also in CI) | `make docker-build` | no |
| Browser | `scripts/browser.mjs`: headless Chromium in the Playwright image, fake mic looping `test/fixtures/booth16k.wav`, against the image | `make docker-browser` | yes |
| Live harness | `server/live/` (Python): RTVI over Protobuf WS like the browser, streams the fixtures at real time, validates every `vc.*` message with `vc.protocol`, checks beats and parity items | `make docker-live` | yes |
| Screenshots | `scripts/shot.mjs` route or `strip.json` fixture against the image | `make shot ROUTE=/cast` | no |
| Evals (second tier) | `server/evals/`: `pipecat eval` personas with expression assertions | lane T | yes |

## 9. Risks the spike must retire (S1.0)

Parity (plan.md §5): (a) Flux→Claude→Flux over this transport with the JS client; (b) `words[].start/end` on `frame.result`; (c) the Nova branch produces no duplicate user turns; (d) Flux→Aura-2 switch including first use of the idle member; (e) mic off 20 s then on: Flux socket fate, reconnect count, lost first words; (f) `vc.latency` vs the old `LatencyReport` on `speech16k.wav`; (g) Haiku 5.5 ↔ Sonnet 5.5 switch with per-model reasoning settings, no 400.

Expression (concept.md §6): (h) perception latency at release and tail latency on source timeout, memory under 2 GB; (i) Silero + EXTEND keeps Flux in charge, count false withdrawals on booth noise; (j) panel tags stripped under speculation, one handler call per turn; (k) eager events reach the browser and nothing from the held reply leaks; (l) backchannel during bot speech does not interrupt (Flux StartOfTurn already broadcasts an interruption: if the detector cannot prevent it, the beat degrades to "drawn but still interrupts" and is reported); (m) SFX timing; (n) FilterIncomplete markers with Claude; (o) speculation reuse rate with perception on.

Scaffold-added: (p) the idle Nova branch behind NovaGate keeps its socket and loses no first words when enabled; (q) server `assistantTurn` (LLMFullResponseStartFrame downstream of the gate) and client `onBotLlmStarted` count stay 1:1, greeting included.

## 10. Decisions taken in the scaffold (beyond the brief)

1. Token travels as the `token` query parameter (that is what `@pipecat-ai/websocket-transport` 1.8.2 does), not the `access_token.` subprotocol. Initial settings travel as `cfg` on the same URL.
2. Nova toggling uses an always-present Nova branch with `NovaGate` instead of rebuilding the pipeline.
3. Under Redact, `vc.turn` / `vc.eager` drop transcript text; visitor panels come from `vc.layer`.
4. `vc.intel` is server-initiated (no client message), which also closes the themes-pollution path.
5. `vc.say` ids are client-chosen (`k-...`) so intel can find the typed panel; no echo is sent.
6. Panel tags carry `assistantTurn` + character offset `at` for audio sync.
7. Fly VM is `shared-cpu-2x` with 2 GB; `MAX_SESSIONS=4` semaphore per machine.
8. `pyproject.toml` and `uv.lock` live in `server/`; the client has its own `web/package.json`; a root `package.json` exists only for Playwright in `scripts/`.
9. Deepgram rates are copied from the original catalog (as of 2026-09-11) and must be re-verified before release; Claude prices are placeholders by design.
