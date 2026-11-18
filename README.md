# Voice Comic on Pipecat

A live comic strip drawn from your voice, rebuilt on [Pipecat](https://github.com/pipecat-ai/pipecat). Every turn of a conversation becomes a panel, and the art comes from what the pipeline perceives: how you sounded, when Flux thought you were done, the face Claude chose for its own reply, how long each stage took.

**Stack:** Pipecat 1.16 (Python) · Deepgram Flux STT with eager end-of-turn · Pipecat perception (voice and tone readers) · Claude Haiku 5.5 / Sonnet 5.5 · Deepgram Flux TTS and Aura-2 · Nova-3 for live redaction and speaker diarization · `@pipecat-ai/client-js` over a WebSocket transport · React + SVG comic engine · FastAPI · SQLite · Fly.io.

> **Status:** scaffold. The contracts, repo layout and build are in place; the pipeline and the client adapter are being built in lanes. See `docs/LANES.md`.

## The beats

| Pipecat / Deepgram feature | What you see |
| --- | --- |
| Perception (`PerceptionReader`, voice + tone) | the visitor's face, laugh SFX and shout bubble follow how they sounded |
| Flux eager end-of-turn + speculative reply | a ghost bubble when Flux predicts you are done; the reply lands the moment it confirms |
| Inline panel tags parsed by `PatternPairAggregator` | Claude picks its own expression, SFX and caption as it writes |
| Flux `eot_threshold` / `eager_eot_threshold` (live) | sliders that change how the strip splits turns; "mhm" draws as a backchannel, not an interruption |
| `UserBotLatencyObserver` + a Flux end-of-turn timer | "replied in 0.4s" with a per-stage breakdown |
| One-shot audio frames | POW, BOING, HA HA come out of the booth speaker |
| Nova-3 redaction and diarization (sibling branch) | censor bars in the bubble; two people at one mic get their own panels |
| Usage metrics | a live cost meter: Pipecat à la carte vs what the Voice Agent API would have charged |

## Run it

```sh
cp .env.example .env        # DEEPGRAM_API_KEY, ANTHROPIC_API_KEY, SESSION_SECRET
make docker-run             # builds the image, serves http://localhost:8080
```

Development loop on the host (needs [uv](https://docs.astral.sh/uv/) and Node 24):

```sh
make install
make test                   # Python + TypeScript unit and contract tests
cd web && npm run dev       # Vite on :5173, proxies /api to the server on :8080
cd server && uv run python -m vc
```

Every gate also runs in Docker: `make docker-test`, `make docker-build`, `make docker-live`, `make docker-browser`.

## Layout

```
server/      Python service (package vc/): FastAPI app, Pipecat pipeline per connection, SQLite store
web/         React + SVG comic engine, Pipecat client
shared/      catalog.json (models, prices, modes) and protocol.schema.json (the vc.* contract), read by both sides
scripts/     Playwright browser test and screenshot tools
test/        audio fixtures and a sample strip
docs/        CONTEXT.md (start here), ARCH.md (contracts), LANES.md (work breakdown), PRESENTER.md
```

## Credits

Ported from [dg-coreylweathers/voice-comic](https://github.com/dg-coreylweathers/voice-comic), the Deepgram Voice Agent API version of this demo. The comic engine, cast, pricing language, booth privacy rules and fixtures come from there. MIT licensed, like the original; see `LICENSE`.
