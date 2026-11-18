"""TurnTap: after flux_stt in the main branch. Reads the raw Flux TurnInfo on InterimTranscriptionFrame.result /
EagerTranscriptionFrame.result / TranscriptionFrame.result and the StartOfTurn/TurnResumed handlers, emits VcTurn
(panelId u-{epoch}-{turn_index}, words with start/end). Passes all frames on. Tracks `epoch` (bump on reconnect).
Spike gate: words[].start/end present on frame.result (was scripts/live.mjs:86)."""
