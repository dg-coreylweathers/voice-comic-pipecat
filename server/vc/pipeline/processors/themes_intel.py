"""ThemesIntel: after the user aggregator. On each finished visitor turn, schedule (asyncio task, never awaited on
the frame path) POST https://api.deepgram.com/v1/read?topics=true&intents=true&language=en {text}, then VcIntel
(panelId of that turn) and deps.themes.record(event, ThemeTurn). Skips < 2 words, cuts at 4000 chars. Agent text
is never sent (panel tags replace that)."""
