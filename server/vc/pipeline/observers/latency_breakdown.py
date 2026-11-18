"""Handler for UserBotLatencyObserver.on_latency_breakdown -> VcLatencyBreakdown (needs Silero VAD frames and
enable_metrics=True). Also forwards on_first_bot_speech_latency to the X-ray via the same message with
assistantTurn=1."""
