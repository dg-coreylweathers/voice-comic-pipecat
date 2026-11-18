# Work breakdown: lanes

Five lanes build in parallel against the frozen contracts in `shared/` and `docs/ARCH.md`. Each lane owns its files outright; touching another lane's file needs that owner's review. Frozen files change only by a contract PR that updates the schema, both mirrors and the shared examples together, reviewed by every affected lane.

Ground rules for every lane:

- Work in your own branch (or worktree), squash to one commit per PR (up to five for a big one), each commit passing `make docker-test` on its own.
- Every gate below runs in Docker. Host runs are fine for iteration, not for sign-off.
- No API key ever lands in a file, a log, a test fixture or a PR description. Live gates read `.env` (gitignored) through `--env-file`.
- A reviewer checks the acceptance list literally: each item is observable in a test, a log line, a screenshot or a Docker command's output.

## Frozen (architect; change by contract PR)

`shared/**`, `server/vc/{protocol,catalog,deps,paths,redaction,prefetch}.py`, `server/tests/{conftest,test_protocol_schema,test_catalog,test_redaction}.py`, `web/src/lib/{protocol,catalog}.ts` (+ their tests), `Dockerfile`, `.dockerignore`, `fly.toml`, `.github/workflows/ci.yml`, `Makefile`, `docs/ARCH.md`, `docs/LANES.md`.

The Panel and Settings beat fields in `web/src/lib/types.ts` (`perception`, `ghost`, `assistantTurn`, `tag`, `backchannels`, `eager`, `latencyBreakdown`, `Settings.flux`) are also frozen: they are the C1/C2 seam.

## Dependency picture

```
S1.0 spike ──► S1 pipeline ──────────────┐
S2 HTTP (parallel from day 1) ───────────┼──► T browser.mjs port + live harness ──► parity run ──► deploy
C1 client adapter (parallel, fake client)┤
C2 UI beats (parallel, fixture panels) ──┘
```

S1 and S2 meet only through `vc/deps.py`; C1 and C2 meet only through `types.ts` panel fields and `store.ts`. Everybody meets through `shared/protocol.schema.json`.

---

## S1: pipeline and processors

**Owns:** `server/vc/pipeline/**`, `server/vc/sessions.py`, `server/vc/assets/sfx/**`, `server/tests/pipeline/**`, `docs/SPIKE.md` (new), and the single `run_bot(...)` call inside the WS handler of `app.py` (S2 owns the rest of that file).

**Inputs:** `vc.protocol`, `vc.catalog`, `vc.deps` (frozen); `PromptBook` from S2 (use a fake until S2 lands); Pipecat 1.16.0 source and `docs/ARCH.md` §3, §5.3, §9.

**Milestone S1.0, the spike (first, half to one and a half days).** Run gates (a)–(q) from ARCH §9 in Docker against real Deepgram and Anthropic with `test/fixtures/*.wav`, write the results (numbers, log excerpts with no transcript text, pass/fail per gate) to `docs/SPIKE.md`. Any failed gate that changes a contract stops the lane and goes back to the architect before more code.

**Acceptance criteria:**

1. `docs/SPIKE.md` exists with a result for every gate (a)–(q), each with the command that produced it.
2. `run_bot` builds the agent pipeline exactly as ARCH §3.1 (processor order, observer list, `ignored_sources`) and the duet pipeline as §3.2. A unit test walks the built pipeline and asserts the processor class order for: agent default, agent + Redact, agent + Two speakers, duet.
3. Privacy test on the built objects: no `TranscriptionLogObserver`, no `AudioBufferProcessor`, no tools on the LLM context, `mip_opt_out` passed to every Deepgram service when `MIP_OPT_OUT=1`.
4. `NovaTap` unit test (Pipecat test helpers, fake frames): Nova `TranscriptionFrame` / `InterimTranscriptionFrame` never leave the branch; one `VcLayer` per diarized speaker run on a final; `redacted` set from `vc.redaction`; all other frames pass in order.
5. `NovaGate` unit test: no `InputAudioRawFrame` passes while Redact and Two speakers are off; audio passes after either turns on; non-audio frames always pass.
6. `TurnTap` unit test with recorded Flux `TurnInfo` payloads: one `VcTurn` per event with `panelId u-{epoch}-{turnIndex}`, words with start/end; under Redact `transcript == ""` and `words == []`; epoch bumps on reconnect.
7. `PanelTagHandler` unit test: `Hello <panel mood="smug" sfx="POW" caption="nope"/> there` speaks `Hello  there` (tag never reaches TTS), emits exactly one `VcPanel` with the right `assistantTurn` and `at`, drops unknown mood/sfx values, cuts caption at 40, and queues the POW one-shot frame; a tag split across LLM tokens still matches.
8. `BackchannelDetector` unit test: an allow-listed short final during bot speech becomes `UserBackchannelFrame`; the same utterance while the bot is silent passes through as a `TranscriptionFrame`.
9. Controls unit tests: every `vc.update` field in ARCH §5.3 produces the listed frame(s) and a `VcConfig` with matching `changes`; the think switch sends model + thinking + effort together (Haiku → Sonnet clears effort, Sonnet → Haiku clears thinking); eager is clamped below eot; an unknown client-message type and a bad payload each produce one `VcError` and no frame; `vc.say` in a duet is refused.
10. `UsageObserver` unit test with synthetic `MetricsFrame`s: Flux and Nova seconds land under their own keys, TTS characters under the active switcher member, tokens under the active think key (including after a mid-session switch), `withdrawnCalls` increments on `UserTurnResponseCancelFrame`; `VcUsage` throttled to ≤ 1/s; final report stored in `deps.usage` on disconnect.
11. `TurnLatencyObserver` unit test: `ProposedUserStoppedSpeakingFrame` then `BotStartedSpeakingFrame` 400 ms later yields `VcLatency(ms≈400, from="flux_end_of_turn")`; a `vc.say` path yields `from="typed_line"`.
12. Every server message the pipeline emits in tests validates with `vc.protocol.parse_server_message` (one shared assertion helper).
13. Live (via T's harness once it exists, or a spike script before): greeting audio arrives; a fixture turn yields `vc.turn` EndOfTurn with word timings, `bot-output`, `vc.latency`, `vc.latency.breakdown`, `vc.panel`, `vc.usage`; Redact on yields `vc.layer` with redaction markers and no visitor text in `vc.turn`; Haiku ↔ Sonnet switch both ways with no 400; Flux → Aura-2 → Flux voice switch audible.
14. Booth: with `BOOTH_MODE=1` a full live run prints no transcript or bot text to the container log (`docker logs` grep for a fixture phrase returns nothing).

**Proof:** `make docker-test` (1–12), `make docker-live` (13), `make docker-live` with `BOOTH_MODE=1` in `.env` then `docker logs` (14).

---

## S2: HTTP API, store, themes, privacy, catalog, prompts, auth

**Owns:** `server/vc/{app,api,auth,ratelimit,store,themes,privacy,prompts,config,logs}.py` (except the `run_bot` call), `server/tests/test_{api,auth,ratelimit,store,themes,privacy,prompts,logs}.py`.

**Inputs:** the Node originals (`~/code/voice-comic/server/*.js` and their tests) as behavioural reference; `vc.catalog`, `vc.redaction`, `vc.deps`, `vc.protocol` (frozen); `UsageRegistry` from S1 (use a fake until S1 lands).

**Acceptance criteria:**

1. Every Node server test (auth, store, privacy, themes, the catalog/route parts of the proxy test) has a Python equivalent that passes; the PR lists the mapping old test → new test.
2. `Auth`: issue/verify round trip, expiry, tamper, wrong length, constant-time compare; token read from the `token` query param.
3. WS `/api/agent`: bad or missing token closes 4401 before accept; bad `cfg` closes 4400; valid token + cfg reaches `run_bot` with a parsed `SessionConfig` (tested with a fake `run_bot`).
4. `GET /api/catalog` equals `public_catalog(...)`: the file plus `event` and `booth`; contains no prompt text.
5. `POST /api/strips`: validation limits as the Node app; server-metered usage from `deps.usage.get(sessionId)` replaces the client's; booth forced by `BOOTH_MODE` or the body; `sanitize_strip` applied; 201 body shape; rate limit 12/min returns 429 JSON.
6. Audio: RIFF check, 25 MB cap, 403 for booth deployment and booth strip, 404 for missing; `GET` serves `audio/wav` with the TTL cache header; purge task removes audio after `AUDIO_TTL_HOURS` and booth strips after `STRIP_TTL_HOURS` (tested with injected clocks).
7. `sanitize_strip` covers the new event types (`vc.turn`, `vc.layer`, `vc.intel`, `user-input`, `bot-output`) in its text-bearing list; entity filter and bucket identical to the Node tests.
8. Themes: tally, taxonomy, entity filter, summary, events list, CSV; `record()` is synchronous, fast (< 5 ms on the test machine) and safe to call from the event loop.
9. `prompts.prompt_for` for every mode × redact; the Q&A fact sheet quotes prices from `vc.catalog` and says "price pending" for placeholders; `panel_tag_instructions()` lists exactly `get_args(PanelMood)` and `get_args(PanelSfx)`; no mention of the Voice Agent API as the runtime; `AGENT_PROMPT` overrides the persona.
10. Logging: with `BOOTH_MODE=1`, `configure_logging` leaves no handler below WARNING (test inspects loguru).
11. Unknown `/api/*` is JSON 404 for every method; SPA fallback serves `index.html` for extension-less paths and 404 for missing files.

**Proof:** `make docker-test`; `make docker-build` then `curl` the endpoints on the running image (`make docker-run`).

---

## C1: Pipecat client adapter, protocol wiring, director mapping

**Owns:** `web/src/lib/{session,store,actions,wav,director}.ts` (director: the perception mapping and signal plumbing; C2 owns the visual constants), `web/src/lib/types.ts` (non-frozen parts), `web/src/lib/perception.ts` (new), `web/src/App.tsx`, `web/src/lib/*.test.ts` for those modules.

**Inputs:** `protocol.ts`, `catalog.ts`, the frozen panel fields; ARCH §4, §5.2–5.5; `@pipecat-ai/client-js` 1.16 and `@pipecat-ai/websocket-transport` 1.8.2 typings.

**Acceptance criteria:**

1. `ComicSession` implements `ComicSessionApi` with `PipecatClient` + `WebSocketTransport` (`ProtobufFrameSerializer`, recorder 16 kHz, player 24 kHz). `audio.ts` stays deleted; no hand-rolled WebSocket remains.
2. Connect flow: mic permission before any token request; `GET /api/session`; `connect({ wsUrl: '/api/agent?cfg=…', token })`; `conn` goes `live` on `vc.session` (agent) or `vc.layer.status open` (duet).
3. A unit test drives `ComicSession` with a fake PipecatClient and the messages in `shared/protocol.examples.json` plus scripted RTVI events, and asserts the panel rules of ARCH §5.4: Flux-mode visitor panel lifecycle; Nova-mode panels with speaker hand-off; agent panel from `bot-llm-started` through `bot-output` to `bot-stopped-speaking`; barge-in truncation at revealed chars; typed line drawn once with no duplicate; `vc.intel` lands on the right `panelId`; a second `vc.session` bumps epoch without losing panels.
4. `vc.panel` is held until the agent panel's revealed chars reach `at`, then sets `panel.tag.applied`; a test proves the face does not change before the matching audio starts.
5. Perception mapping (`perception.ts`) implements ARCH §5.5 with exported thresholds; table-driven test covers every row, the arousal shout, and "no perception → falls back to intel sentiment, else neutral".
6. Pause is `enableMic(false)` plus a local playback flush; nothing is sent to the server (test asserts no client-message on pause/resume). Reset sends `vc.reset` and draws the divider without reconnecting. Scene change reconnects with a new `cfg`.
7. `applySettings` sends one `vc.update` with only the changed fields (including `flux` dials) and logs the `vc.config` answer to the X-ray events; no ack timer exists.
8. Booth latch: once booth is on, no audio is kept in memory and `save()` uploads none; `save()` sends `sessionId` so the server usage wins.
9. `npm test`, `npm run typecheck`, `npm run build` pass; the bundle still builds with the client-js packages tree-shaken (report the gzip size in the PR).
10. Live: with S1 merged, `make docker-browser` reaches a live session, draws at least one visitor and one robot panel from the fake mic, and shows `vc.session` in the X-ray.

**Proof:** `make docker-test` (1–9); `make docker-browser` (10).

---

## C2: UI beats

**Owns:** `web/src/comic/**`, `web/src/ui/**`, `web/src/lib/{pricing,hotkeys,cloud,format,modes,experience}.ts` (+ tests), `web/src/styles.css`, `web/index.html`. Visual constants in `director.ts` (colours, SFX glyph choice, label wording) by agreement with C1.

**Inputs:** the frozen panel fields; `catalog.ts` (prices, Flux dial ranges); `UsageReport` from `protocol.ts`; ARCH §5.5–5.6 and §7 (consent copy); fixture strips you write under `test/fixtures/` with every beat populated.

**Acceptance criteria (each with a screenshot from `make shot` in the PR):**

1. **Ghost bubble:** `panel.ghost.phase === 'predicted'` draws the visitor bubble faint with "Flux thinks you're done"; `withdrawn` dissolves it with "waited for you"; `released` solidifies it and the robot panel shows "replied in N.Ns" (with an eager marker when `panel.eager`).
2. **Backchannel bubble:** `panel.backchannels` render as small bubbles on the robot panel without the interrupted styling.
3. **Flux dials:** toolbar sliders for `eotThreshold` and `eagerEotThreshold` with ranges and defaults from `catalog.flux`, eager kept below eot in the UI, changes go through `changeSettings({ flux })`; hidden in a duet.
4. **Latency pill:** the panel's top pill shows the total and, on hover/expand or in the X-ray, the `latencyBreakdown.parts` (STT, LLM TTFB, TTS TTFB).
5. **Panel-audio sync visuals:** the robot's expression, SFX glyph and caption come from `panel.tag` once `applied`; `smug` / `laughing` render (new art or a documented fallback to happy); no tag keeps neutral.
6. **Visitor faces from perception:** the face, SFX and micro-label follow C1's mapping output; labels are in the comic's voice ("cracking up", "not buying it"); no raw label text appears outside the X-ray.
7. **X-ray rows:** pipeline view from `vc.session` / `vc.config` replaces "Copy agent Settings JSON" (copy button copies the pipeline JSON); rows for perception signals, eager phases, `vc.config` changes (live vs reconnect), and the metrics TTFBs; the websocat helper still copies the Flux URL.
8. **Cost modal:** two bars, "Pipecat à la carte" (STT + TTS + Claude tokens + add-ons, from `UsageReport` and catalog prices) and "Voice Agent API equivalent" (`connectedMsByTier` × regular tier rate + Nova tap minutes); placeholder prices render "price pending" and are excluded from totals with a visible note; withdrawn speculative calls shown as their own line. `pricing.test.ts` rewritten for `UsageReport` with a case for each line and for placeholders.
9. **Copy:** hero, `/how`, consent, attract loop and presenter-facing text say Pipecat + Flux + Claude, not "through the Voice Agent API"; the consent screen carries the two sentences from ARCH §7.
10. Replay of a saved strip (`/s/:id`) renders every beat field from the fixture strip.

**Proof:** `make docker-test`; `make shot ROUTE=test/fixtures/<your-fixture>.json OUT=test/shots/<beat>.png` per beat; `make docker-browser` once C1 and S1 are in.

---

## T: tests (browser port, Python live harness, eval scenarios)

**Owns:** `scripts/browser.mjs`, `scripts/lib.mjs`, `scripts/shot.mjs`, `scripts/make-duet-fixture.mjs`, `server/live/**`, `server/evals/**`, new audio fixtures under `test/fixtures/` (for example `mhm-during-speech16k.wav`, `booth-noise16k.wav`), root `package.json`.

**Inputs:** ARCH §5 and §8, the old `scripts/live.mjs` and `scripts/browser.mjs` as the check inventory (65 and 58 checks), `vc.protocol` for validation, `pipecat.evals` for scenarios.

**Acceptance criteria:**

1. `server/live` (`python -m live`, run by `make docker-live`): speaks RTVI over the Protobuf WebSocket (Pipecat's `ProtobufFrameSerializer` frames), gets a token, connects with a `cfg`, streams fixtures at real time, and validates every `server-message` with `vc.protocol.parse_server_message`. Prints PASS/FAIL per check and exits non-zero on any FAIL.
2. Live checks cover, at minimum: token required (4401 without); bad cfg 4400; greeting audio; `vc.session` shape; Flux `vc.turn` Update and EndOfTurn with word timings; `bot-output` text; `vc.latency` and `vc.latency.breakdown`; `vc.panel` at least once in three turns; `vc.usage` with Flux seconds, TTS chars, Claude tokens; Redact on → `vc.layer` with redaction markers and empty `vc.turn` transcript; Two speakers → speaker ids on `vc.layer`; keyterms update → `vc.config` live; Haiku ↔ Sonnet switch with no `vc.error`; Flux ↔ Aura-2 switch with audio after; `vc.say` gets a reply and `vc.intel` for its id; `vc.reset` gets a fresh greeting; mic silence 20 s then speech still transcribes (reports reconnects); duet leg with diarization and no bot audio; save strip with `sessionId` and confirm server-metered usage; booth strip rules (403 audio, trimmed). Each old live.mjs check is mapped to a new check or listed as dropped with the reason.
3. `scripts/browser.mjs` ported to the Pipecat build: every old check mapped or dropped with a reason, plus new checks for ghost bubble (any phase seen), latency pill, X-ray pipeline view, cost modal with two bars, Flux dial change reflected in `vc.config`, backchannel bubble when the fixture contains one. Runs headless in the Playwright image via `make docker-browser`; `VC_BASE` still targets a deployment.
4. `make shot` works for routes and fixture strips against the image (`VC_LOCAL_BASE`), never posting fixtures to a deployment.
5. Eval scenarios (second tier, after parity): at least three `pipecat eval` personas (heckler, toddler, sarcastic developer) with goals and expression assertions, runnable in Docker, documented in `server/evals/__init__.py`.
6. No fixture or log contains an API key; harness output never prints transcript text when `BOOTH_MODE=1`.

**Proof:** `make docker-live`, `make docker-browser`, `make shot ROUTE=/cast`.

---

## Release checklist (coordinator)

- All lane acceptance lists checked; `docs/SPIKE.md` gates green or explicitly waived.
- Claude prices in `shared/catalog.json` filled from the Claude docs with `rates.llmAsOf`; Deepgram rates re-verified against deepgram.com/pricing with `rates.asOf` updated.
- Fly: app `dg-voice-comic-pipecat` (org deepgram, ewr), volume `voice_comic_pipecat_data` 1 GB, secrets `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `SESSION_SECRET`, repo secret `FLY_API_TOKEN`.
- `make docker-browser` with `VC_BASE=https://dg-voice-comic-pipecat.fly.dev` green after the first deploy.
