"""NovaGate: first processor of the Nova branch. Drops InputAudioRawFrame while neither Redact nor Two speakers is
on, so the Nova branch exists from the start (ParallelPipeline branches are fixed at construction) but sends no
audio and bills nothing until needed. controls.py flips it and, when redact/diarize change, sends
STTUpdateSettingsFrame to nova_stt (a reconnect). Passes every non-audio frame."""
