"""Build and run one Pipecat pipeline per WebSocket connection. Lane S1.

Agent experience (docs/ARCH.md section 3):

  transport.input()
    -> ParallelPipeline([flux_stt, turn_tap], [nova_stt, nova_tap])   # nova branch only when redact or speakers
    -> perception      (vc.pipeline.perception.build_perception_reader: PerceptionReader voice + tone)
    -> backchannel     (BackchannelDetector)
    -> user_aggregator (LLMUserAggregatorParams: vad_analyzer=SileroVADAnalyzer(),
                        user_turn_strategies=FilterIncompleteUserTurnStrategies(),
                        user_turn_strategies_params=UserTurnStrategiesParams(EXTEND, EXTEND))
    -> themes_intel    (ThemesIntel, fire-and-forget /v1/read)
    -> redact_scrub    (RedactScrub, only rewrites what RTVI shows; never what Claude gets)
    -> llm             (AnthropicLLMService, enable_prompt_caching=True, no tools)
    -> panel_tags      (LLMTextProcessor(text_aggregator=PatternPairAggregator) + PanelTagHandler)
    -> tts             (ServiceSwitcher([DeepgramFluxTTSService, DeepgramTTSService]))
    -> transport.output()
    -> assistant_aggregator

  PipelineWorker(pipeline, params=PipelineParams(audio_in_sample_rate=16000, audio_out_sample_rate=24000,
      enable_metrics=True, enable_usage_metrics=True, enable_expressive_conversation=True),
      observers=[TurnLatencyObserver, UserBotLatencyObserver(+handler), EagerObserver, UsageObserver],
      rtvi_observer_params=RTVIObserverParams(ignored_sources=[nova_stt, nova_tap]))
  NOTE: no TranscriptionLogObserver, no AudioBufferProcessor, ever (booth privacy).

Duet experience: transport.input() -> nova_stt(diarize) -> nova_tap -> transport.output(); no LLM, no TTS.

Transport: FastAPIWebsocketTransport(websocket, FastAPIWebsocketParams(audio_in_enabled=True,
audio_out_enabled=True, add_wav_header=False, serializer=ProtobufFrameSerializer(), session_timeout=None)).
Concurrency: `async with deps.slots` around the run; when full, close 1013 "busy" before building anything.
"""

from __future__ import annotations

from fastapi import WebSocket

from vc.deps import BotDeps
from vc.protocol import SessionConfig


async def run_bot(websocket: WebSocket, cfg: SessionConfig, deps: BotDeps) -> None:
    """Runs until the client disconnects. Must put the final UsageReport in deps.usage before returning."""
    raise NotImplementedError("TODO(S1)")
