"""BackchannelDetector (beat 4): between perception and the user aggregator. While the bot is speaking
(BotStartedSpeakingFrame..BotStoppedSpeakingFrame), a final TranscriptionFrame whose normalized text is in the
allow-list ("mhm", "uh huh", "yeah", "right", "okay", "ok", "wow", "ha", "haha", "nice") and <= 3 words is replaced by
UserBackchannelFrame(text=...) so RTVI reports user-input input_type=backchannel and the bot keeps talking.
Open question for the spike: Flux's StartOfTurn already broadcast an interruption; see docs/ARCH.md risks."""
