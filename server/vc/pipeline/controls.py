"""Client messages -> Pipecat frames. Lane S1. Registered as RTVIProcessor `on_client_message`.

vc.update field     -> frame (live?)
  listenKey (flux en<->multi) -> STTUpdateSettingsFrame(delta=Settings(model=...)) on flux_stt   (reconnect; epoch++)
  keyterms            -> STTUpdateSettingsFrame(keyterm=[...]) on flux_stt (+ nova_stt if running) (live Configure)
  flux.eotThreshold / flux.eagerEotThreshold -> STTUpdateSettingsFrame on flux_stt (live Configure; clamp eager<eot)
  speakKey same family -> TTSUpdateSettingsFrame(voice=..., service=member)                     (reconnect for Flux)
  speakKey other family -> ManuallySwitchServiceFrame(service=member) (+ voice update first if needed)
  thinkKey            -> LLMUpdateSettingsFrame(delta=services.llm_settings_for(think))          (live)
  modeKey / redact    -> LLMUpdateSettingsFrame(delta=Settings(system_instruction=prompt_for(...)))  (live)
  redact / speakers   -> rebuild the nova tap branch membership (see docs/ARCH.md "Nova tap toggling")
vc.say  -> LLMMessagesAppendFrame([{"role": "user", "content": text}], run_llm=True); TurnLatency from here
vc.reset-> InterruptionFrame, LLMMessagesUpdateFrame(messages=[], run_llm=False), then greeting unless quiet
Every applied message answers with VcConfig(changes=[ConfigChange...]); invalid ones with VcError.
An unknown client-message type is rejected with VcError and ignored.
"""
