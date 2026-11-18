# Voice Comic on Pipecat: working context

Handoff notes. Read this, then `docs/ARCH.md` (contracts) and `docs/LANES.md` (who builds what), then the code.

## What it is

A live comic strip drawn from a conversation, built as a Deepgram developer-conference booth demo. This repo is the Pipecat port of the original Voice Agent API version (github.com/dg-coreylweathers/voice-comic). The premise changes from "the comic draws what Deepgram's events say" to **the comic draws what the pipeline perceives**: Flux stays the star on both ends, and Pipecat's machinery (perception, speculative turns, turn-taking dials, observers, structured bot output) becomes visible on the strip.

- Target: Fly app `dg-voice-comic-pipecat` (org `deepgram`, region `ewr`, one always-on shared-cpu-2x 2 GB machine, volume `voice_comic_pipecat_data` at `/data`). CI deploys on push to `main` with `FLY_API_TOKEN`.
- Pages (unchanged from the original): `/` live strip with an attract loop, `/how`, `/cast`, `/themes`, `/s/:id` replay. Any extension-less path serves the SPA; unknown `/api/*` answers JSON 404.
- Presenter notes: `docs/PRESENTER.md` (copied from the original; lane C2 updates the wording for Pipecat).

## Architecture in one paragraph

Browser (React + one big SVG, `@pipecat-ai/client-js` over `@pipecat-ai/websocket-transport` with Protobuf frames) → one Python service on Fly (`python -m vc`: FastAPI + uvicorn, `sqlite3`) → Deepgram and Anthropic. Each WebSocket gets its own Pipecat 1.16.0 pipeline: Flux STT (eager end of turn) → perception (voice + tone readers) → backchannel detector → user aggregator (Silero VAD, Flux strategies kept) → themes intel (`/v1/read`, fire-and-forget) → Claude (Haiku 5.5 or Sonnet 5.5, no tools) → panel-tag processor (`<panel .../>` → `vc.panel` + one-shot SFX) → Flux TTS / Aura-2 behind a ServiceSwitcher. A sibling Nova-3 branch runs only while Redact or Two speakers is on and never feeds Claude; the duet scene is Nova-3 alone. App-level messages are `vc.*` RTVI server/client messages defined once in `shared/protocol.schema.json`.

## The six beats

1. Visitor faces from how they sounded (Pipecat perception, `user-input.perception`).
2. Ghost bubble: Flux predicted the end of turn; Claude's held reply lands when Flux confirms (`vc.eager`).
3. The robot draws its own panel: Claude's inline tag picks mood, SFX, caption (`vc.panel`).
4. Turn-taking dials a visitor can flip (Flux `eot_threshold`, `eager_eot_threshold`, live) and a backchannel bubble that does not interrupt.
5. Show me the wire: per-turn latency breakdown (`vc.latency`, `vc.latency.breakdown`) and the real pipeline in the X-ray.
6. SFX you can hear: one-shot sounds mixed into the bot audio at panel events.

## What changed from the Voice Agent version

- No bundled per-minute billing. Cost is STT seconds + TTS characters + Claude tokens; the cost modal compares that with what the Voice Agent API would have charged for the same connection time.
- One Flux stream instead of two (the primary Flux STT feeds both Claude and the turn layer).
- Hot swaps are in-process frames (`STTUpdateSettingsFrame`, `ManuallySwitchServiceFrame`, `LLMUpdateSettingsFrame`); no ack timeouts, no reconnect fallback. `vc.config` answers every update.
- Pause is mic off on the client. No STT seconds and no server meter accrue while paused.
- The Flux → Nova listen hot swap in the LLM path is gone: Nova is a tap branch only (Redact, Two speakers) and the whole duet.
- GPT-4o mini is gone (Anthropic key only).
- Typed lines (`vc.say`) get no echo; the client draws them and the server runs the LLM.
- Themes are tallied server-side from finalized turns; there is no client `vc.intel` request any more.

## Decisions already made (do not reopen without the coordinator)

See `docs/ARCH.md` §10 for scaffold-level decisions. Fixed by the brief: one Python service; Python 3.12; `pipecat-ai[deepgram,anthropic,websocket,silero,tone]==1.16.0` via uv; Flux STT primary with eager end of turn; Nova-3 only as the sibling tap and in duet; Flux TTS default with Aura-2 via ServiceSwitcher; Silero VAD on the user aggregator with Flux strategies kept by EXTEND merge modes; no tools in the agent path, ever; perception models baked into the image; booth mode = WARNING logs, no transcription log observer, no audio buffer, strips trimmed and TTL'd, `mip_opt_out` configurable; catalog offers `claude-haiku-5-5` (default, standard) and `claude-sonnet-5-5` (advanced) with reasoning settings per model.

## Known facts carried over from the original (verified live there)

- Streaming Nova-3 diarization warms up: the first 15 to 30 s are often all speaker 0. The duet chip says "learning your voices…" until two ids are seen.
- Nova `numbers` redaction can emit a literal `[REDACTED]`; PII redaction emits `[NAME_GIVEN_1]`-style tokens. Flux only supports `redact=numbers`.
- A Flux `/v2/listen` socket closed after roughly ten silent seconds in the original (it ignores KeepAlive). Whether Pipecat's Flux service reconnects cleanly after a long mic-off is spike gate (e) in ARCH §9.
- SVG presentation `transform` attributes are overridden by CSS `transform` animations on the same element; animate a child group.

## Open, live-only (spike S1.0)

Flux idle-close and reconnect churn after a long pause; `words[].start/end` on Flux `TurnInfo` via `frame.result`; two STT services in one ParallelPipeline end to end; perception latency and memory; VAD false withdrawals on booth noise; backchannel versus Flux's own interruption; speculation reuse with perception on; idle Nova branch behind NovaGate. Results go to `docs/SPIKE.md`.

## How to run and test

```sh
cp .env.example .env              # DEEPGRAM_API_KEY, ANTHROPIC_API_KEY, SESSION_SECRET
make docker-test                  # Python + TS unit and contract tests, lint, typecheck, client build (no keys)
make docker-build                 # the production image (bakes the perception models)
make docker-run                   # the image on http://localhost:8080 with your .env
make docker-live                  # Python live harness against the image (lane T; real Deepgram + Anthropic)
make docker-browser               # headless Chromium + fake mic against the image (lane T)
make shot ROUTE=/cast OUT=test/shots/cast.png
make install && make test         # host loop: needs uv and Node 24
```

Fixtures: `test/fixtures/booth16k.wav` (two utterances with silences; Chrome loops it), `speech16k.wav`, `speech2_16k.wav`, `duet16k.wav` (two Aura-2 voices, six turns), `strip.json` (a six-panel strip covering intel, redaction, barge-in, model switch). `scripts/make-duet-fixture.mjs` regenerates the duet fixture (needs `DEEPGRAM_API_KEY`).
