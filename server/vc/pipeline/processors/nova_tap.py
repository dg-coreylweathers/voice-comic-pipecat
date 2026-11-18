"""NovaTap: last processor of the Nova branch. CONSUMES TranscriptionFrame and InterimTranscriptionFrame (so the
user aggregator never sees a second user turn), emits VcLayer (one per diarized speaker run on finals, redacted
flag via vc.redaction) and VcLayerStatus. Passes every other frame. Listed in RTVIObserverParams.ignored_sources."""
