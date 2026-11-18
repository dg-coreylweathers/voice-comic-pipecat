"""Beats 3 and 6. LLMTextProcessor(text_aggregator=PatternPairAggregator()) between llm and tts, with the pair
("<panel", "/>") registered in REMOVE mode so the tag never reaches TTS. The match handler parses mood/sfx/caption
(unknown values dropped, caption cut to 40), pushes VcPanel(assistantTurn, at=chars of spoken text so far) and,
when sfx has a one-shot, pushes the preloaded OutputAudioRawFrame from processors/sfx.py. At most one panel per
assistant turn; no tag -> nothing (the client keeps a neutral face)."""
